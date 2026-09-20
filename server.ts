import {config} from 'dotenv';config({path:'.env.local'});config();
import next from 'next';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {WebSocketServer,WebSocket} from 'ws';
import {CortexRuntime} from './src/cognition/runtime';
import {GradiumBridge} from './src/integrations/gradium/bridge';
import {SpeechResponses} from './src/integrations/gradium/playback';
import {inferenceConfig} from './src/integrations/inference';
import {stopWords} from './src/integrations/jev';
const dev=process.env.NODE_ENV!=='production';const port=Number(process.env.PORT??3000);const app=next({dev,hostname:'127.0.0.1',port});await app.prepare();const handle=app.getRequestHandler();
let client:WebSocket|null=null;
const runtime=new CortexRuntime(state=>{if(client?.readyState===WebSocket.OPEN)client.send(JSON.stringify({type:'snapshot',state}));});
const server=createServer(async(req,res)=>{
 if(req.url?.startsWith('/evidence/')){try{const name=req.url.slice(10);if(!/^[a-f0-9-]+\.png$/.test(name))throw new Error();const dir=process.env.CORTEX_MEMORY_DIR||path.join(process.cwd(),'memory');res.setHeader('Content-Type','image/png');res.end(await readFile(path.join(dir,name)));}catch{res.statusCode=404;res.end();}return;}
 if(req.url==='/api/capabilities'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({gradiumConfigured:!!process.env.GRADIUM_API_KEY,ttsConfigured:!!process.env.GRADIUM_API_KEY&&!!process.env.GRADIUM_VOICE_ID,conversationConfigured:!!inferenceConfig(),inferenceProvider:inferenceConfig()?.name??null}));return;}
 if(req.url==='/api/status'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(runtime.state));return;}
 if(req.url==='/api/traces'){res.setHeader('Content-Type','application/json');res.setHeader('Content-Disposition','attachment; filename="cortex-trace.json"');res.end(JSON.stringify(runtime.state.traces,null,2));return;}
 handle(req,res);
});
const wss=new WebSocketServer({noServer:true,maxPayload:9_000_000});
server.on('upgrade',(req,socket,head)=>{
 if(new URL(req.url??'/',`http://localhost:${port}`).pathname!=='/ws'){if(dev)app.getUpgradeHandler()(req,socket,head);else socket.destroy();return;}
 const origin=req.headers.origin;
 if(origin&&origin!==`http://127.0.0.1:${port}`&&origin!==`http://localhost:${port}`){socket.destroy();return;}
 wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
// Serialize admission and disconnect stops: an old tab's asynchronous cleanup
// must never stop or clear a newly granted controller.
let admission=Promise.resolve();
wss.on('connection',(ws,req)=>{
 admission=admission.then(async()=>{
  if(ws.readyState!==WebSocket.OPEN)return;
  const takeover=new URL(req.url??'/ws',`http://localhost:${port}`).searchParams.get('takeover')==='1';
  if(client?.readyState===WebSocket.OPEN&&!takeover){ws.close(1008,'One operator at a time');return;}
  if(client){const previous=client;client=null;previous.close(1008,'Control moved to another tab');await runtime.stop('Control transferred between tabs');}
  if(ws.readyState===WebSocket.OPEN)connectOperator(ws);
 }).catch(error=>{runtime.fail(error);ws.close(1011,'Control transfer failed');});
});
function connectOperator(ws:WebSocket){
 client=ws;runtime.clientBeat=Date.now();runtime.emit();let commandQueue=Promise.resolve();let controlEpoch=0;
 let speechGeneration=0;const speech=new SpeechResponses();
 function interruptSpeech(){
  speechGeneration++;speech.cancel();runtime.interruptConversation();
  gradium.send({type:'interrupt'});
  if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'voice_interrupted'}));
 }
 function speakReply(generation:number){
  if(client!==ws||generation!==speechGeneration||!process.env.GRADIUM_VOICE_ID||runtime.state.providers.GRADIUM.mode!=='LIVE')return;
  const reply=speech.begin();
  ws.send(JSON.stringify({type:'voice_reply',text:runtime.state.response,...reply}));
  gradium.send({type:'speak',text:runtime.state.response,...reply});
 }
 const gradium=new GradiumBridge(raw=>{
  if(client!==ws)return;
  const event=raw as {type?:string;message?:string;interim?:boolean;transcript?:string;requestId?:string};
  if(event.type==='voice_audio'){const reply=speech.match(event.requestId);if(reply&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({...event,voiceEpoch:reply.voiceEpoch}));return;}
  if(event.type==='error'){runtime.fail(event.message??'Pipecat voice error');return;}
  if(event.type==='interruption')return; // speech_start already cancelled the previous turn.
  const isStop=event.type==='voice_turn'&&stopWords(event.transcript??'');
  if(isStop||(event.type==='voice_turn'&&!event.interim))interruptSpeech();
  const generation=speechGeneration;
  void runtime.gradium(raw).then(()=>{
   if(event.type==='voice_turn'&&(!event.interim||isStop))speakReply(generation);
  }).catch(e=>{if(generation===speechGeneration)runtime.fail(e);});
 },status=>{
  if(client!==ws)return;
  if(status==='LIVE'){runtime.state.mode='REAL';runtime.state.providers.GRADIUM.mode='LIVE';runtime.state.providers.PIPECAT={mode:'LIVE',active:true};ws.send(JSON.stringify({type:'gradium_ready'}));}
  else if(status==='OFFLINE'){runtime.state.providers.GRADIUM.mode='OFFLINE';runtime.state.providers.PIPECAT={mode:'OFFLINE',active:false};ws.send(JSON.stringify({type:'gradium_closed'}));void runtime.stop('Voice connection closed').catch(e=>runtime.fail(e));}
  else runtime.fail(status);runtime.emit();
 });
 ws.on('message',async data=>{try{
  if(client!==ws)return;
  const raw=JSON.parse(data.toString());speech.observe(raw.voiceEpoch);
  if(raw.type==='mic_start'){gradium.connect();return;}
  if(raw.type==='mic_stop'){interruptSpeech();gradium.close();if(process.env.CORTEX_MODE!=='REAL'){runtime.state.mode='DEMO';runtime.state.providers.GRADIUM.mode='DEMO';}return;}
  if(raw.type==='speak_response'){if(!process.env.GRADIUM_VOICE_ID)throw new Error('Set GRADIUM_VOICE_ID for speech playback');if(runtime.state.providers.GRADIUM.mode!=='LIVE')throw new Error('Connect the microphone to start the voice session');interruptSpeech();speakReply(speechGeneration);return;}
  if(raw.type==='audio'){if(typeof raw.data!=='string'||raw.data.length>300000)throw new Error('Invalid audio packet');gradium.audio(raw.data);return;}
  if(raw.type==='speech_start'){interruptSpeech();runtime.timing.clear();runtime.timing.mark('speech_start');gradium.send({type:'speech_start'});return;}
  if(raw.type==='speech_end'){runtime.timing.mark('speech_end');gradium.send({type:'speech_end'});return;}
  if(raw.type==='manual_renew'){await runtime.command(raw);return;}
  if(raw.type==='manual_start'||raw.type==='manual_end'){controlEpoch++;if(raw.type==='manual_start')interruptSpeech();await runtime.command(raw);return;}
  if(raw.type==='heartbeat'){await runtime.command(raw);return;}
  if(raw.type==='stop'||raw.type==='reset'||(raw.type==='text'&&stopWords(String(raw.text??'')))||(raw.type==='fixture'&&raw.name==='stop')){controlEpoch++;interruptSpeech();const generation=speechGeneration;const action=runtime.command(raw);if(raw.type==='reset')commandQueue=action.catch(e=>runtime.fail(e));await action;speakReply(generation);return;}
  if(raw.type==='text'){interruptSpeech();const generation=speechGeneration;await runtime.command(raw);speakReply(generation);return;}
  if(raw.type==='tool')interruptSpeech();
  const token=controlEpoch;commandQueue=commandQueue.then(async()=>{if(client===ws&&token===controlEpoch)await runtime.command(raw);}).catch(e=>runtime.fail(e));await commandQueue;
 }catch(e){runtime.fail(e);}});
 ws.on('close',()=>{
  const owned=client===ws;if(owned)client=null;gradium.close();
  if(!owned)return;
  runtime.interruptConversation();runtime.clientBeat=0;
  admission=admission.then(()=>runtime.stop('Operator disconnected')).catch(e=>runtime.fail(e));
 });
}
setInterval(()=>void runtime.poll(),100);
server.listen(port,'127.0.0.1',()=>console.log(`CORTEX http://localhost:${port}`));
