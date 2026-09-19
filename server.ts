import {config} from 'dotenv';config({path:'.env.local'});config();
import next from 'next';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {WebSocketServer,WebSocket} from 'ws';
import {CortexRuntime} from './src/cognition/runtime';
import {GradiumBridge} from './src/integrations/gradium/bridge';
import {stopWords} from './src/integrations/jev';
const dev=process.env.NODE_ENV!=='production';const port=Number(process.env.PORT??3000);const app=next({dev,hostname:'127.0.0.1',port});await app.prepare();const handle=app.getRequestHandler();
let client:WebSocket|null=null;
const runtime=new CortexRuntime(state=>{if(client?.readyState===WebSocket.OPEN)client.send(JSON.stringify({type:'snapshot',state}));});
const server=createServer(async(req,res)=>{
 if(req.url?.startsWith('/evidence/')){try{const name=req.url.slice(10);if(!/^[a-f0-9-]+\.png$/.test(name))throw new Error();res.setHeader('Content-Type','image/png');res.end(await readFile('.data/'+name));}catch{res.statusCode=404;res.end();}return;}
 if(req.url==='/api/capabilities'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({gradiumConfigured:!!process.env.GRADIUM_API_KEY,ttsConfigured:!!process.env.GRADIUM_VOICE_ID}));return;}
 if(req.url==='/api/status'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(runtime.state));return;}
 if(req.url==='/api/traces'){res.setHeader('Content-Type','application/json');res.setHeader('Content-Disposition','attachment; filename="cortex-trace.json"');res.end(JSON.stringify(runtime.state.traces,null,2));return;}
 handle(req,res);
});
const wss=new WebSocketServer({noServer:true,maxPayload:9_000_000});
server.on('upgrade',(req,socket,head)=>{
 if(req.url!=='/ws'){if(dev)app.getUpgradeHandler()(req,socket,head);else socket.destroy();return;}
 const origin=req.headers.origin;
 if(origin&&origin!==`http://127.0.0.1:${port}`&&origin!==`http://localhost:${port}`){socket.destroy();return;}
 wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
});
wss.on('connection',ws=>{
 if(client&&client.readyState===WebSocket.OPEN){ws.close(1008,'One operator at a time');return;}
 client=ws;runtime.clientBeat=Date.now();runtime.emit();let commandQueue=Promise.resolve();let controlEpoch=0;
 let lastSpoken='',lastSpokenAt=0;
 const gradium=new GradiumBridge(raw=>{
  const event=raw as {type?:string;message?:string;interim?:boolean;transcript?:string};
  if(event.type==='voice_audio'){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(raw));return;}
  if(event.type==='error'){runtime.fail(event.message??'Pipecat voice error');return;}
  const handled=runtime.gradium(raw),epoch=runtime.epoch;
  void handled.then(()=>{
   const shouldRespond=event.type==='voice_turn'&&(!event.interim||stopWords(event.transcript??''));
   if(shouldRespond&&epoch===runtime.epoch&&process.env.GRADIUM_VOICE_ID&&runtime.state.providers.GRADIUM.mode==='LIVE'){
    const reply=runtime.state.response;
    if(reply!==lastSpoken||Date.now()-lastSpokenAt>2000){gradium.send({type:'speak',text:reply});lastSpoken=reply;lastSpokenAt=Date.now();}
   }
  }).catch(e=>runtime.fail(e));
 },status=>{
  if(status==='LIVE'){runtime.state.mode='REAL';runtime.state.providers.GRADIUM.mode='LIVE';runtime.state.providers.PIPECAT={mode:'LIVE',active:true};ws.send(JSON.stringify({type:'gradium_ready'}));}
  else if(status==='OFFLINE'){runtime.state.providers.GRADIUM.mode='OFFLINE';runtime.state.providers.PIPECAT={mode:'OFFLINE',active:false};ws.send(JSON.stringify({type:'gradium_closed'}));void runtime.stop('Voice connection closed').catch(e=>runtime.fail(e));}
  else runtime.fail(status);runtime.emit();
 });
 ws.on('message',async data=>{try{
  const raw=JSON.parse(data.toString());
  if(raw.type==='mic_start'){gradium.connect();return;}
  if(raw.type==='mic_stop'){gradium.close();if(process.env.CORTEX_MODE!=='REAL'){runtime.state.mode='DEMO';runtime.state.providers.GRADIUM.mode='DEMO';}return;}
  if(raw.type==='speak_response'){if(!process.env.GRADIUM_VOICE_ID)throw new Error('Set GRADIUM_VOICE_ID for speech playback');if(runtime.state.providers.GRADIUM.mode!=='LIVE')throw new Error('Connect the microphone to start the voice session');gradium.send({type:'speak',text:runtime.state.response});return;}
  if(raw.type==='audio'){if(typeof raw.data!=='string'||raw.data.length>300000)throw new Error('Invalid audio packet');gradium.audio(raw.data);return;}
  if(raw.type==='speech_start'){runtime.timing.clear();runtime.timing.mark('speech_start');gradium.send({type:'speech_start'});return;}
  if(raw.type==='speech_end'){runtime.timing.mark('speech_end');gradium.send({type:'speech_end'});return;}
  if(raw.type==='heartbeat'){await runtime.command(raw);return;}
  if(raw.type==='stop'||raw.type==='reset'||(raw.type==='text'&&stopWords(String(raw.text??'')))||(raw.type==='fixture'&&raw.name==='stop')){controlEpoch++;gradium.send({type:'interrupt'});const action=runtime.command(raw);if(raw.type==='reset')commandQueue=action.catch(e=>runtime.fail(e));await action;return;}
  const token=controlEpoch;commandQueue=commandQueue.then(async()=>{if(token===controlEpoch)await runtime.command(raw);}).catch(e=>runtime.fail(e));await commandQueue;
 }catch(e){runtime.fail(e);}});
 ws.on('close',()=>{client=null;gradium.close();runtime.clientBeat=0;void runtime.stop('Operator disconnected').catch(e=>runtime.fail(e));});
});
setInterval(()=>void runtime.poll(),100);
server.listen(port,'127.0.0.1',()=>console.log(`CORTEX http://localhost:${port}`));
