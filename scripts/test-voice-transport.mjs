// Real web runtime; local voice and robot doubles. No cloud calls or real audio claim.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {WebSocketServer,WebSocket} from 'ws';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const robot=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({pose:{x:0,y:0,yaw:0},velocity:0,qpos:Array(19).fill(0),status:'idle',timestamp:Date.now(),nearestObstacle:3,estop:false,currentWaypoint:'BENCH'}));});
robot.listen(0,'127.0.0.1');await once(robot,'listening');
const voice=new WebSocketServer({host:'127.0.0.1',port:0});await once(voice,'listening');
let sidecar;const voiceEvents=[];
voice.on('connection',ws=>{sidecar=ws;ws.send(JSON.stringify({type:'voice_ready'}));ws.on('message',raw=>{const event=JSON.parse(raw);voiceEvents.push(event);if(event.type==='speak')ws.send(JSON.stringify({type:'voice_audio',audio:'AAA=',sampleRate:48000}));});});
const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
let logs='';
const child=spawn(process.execPath,['--import','tsx','server.ts'],{env:{...process.env,NODE_ENV:'production',PORT:String(port),GRADIUM_API_KEY:'local-test',GRADIUM_VOICE_ID:'local-test',SAMBANOVA_API_KEY:'',MEMORIES_API_KEY:'',CORTEX_MODE:'DEMO',PIPECAT_API_URL:`http://127.0.0.1:${voice.address().port}`,MUJOCO_API_URL:`http://127.0.0.1:${robot.address().port}`},stdio:['ignore','pipe','pipe']});
child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
let client;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/api/capabilities`)).ok)break;}catch{}if(child.exitCode!==null)throw new Error(logs);await wait(100);}
 client=new WebSocket(`ws://127.0.0.1:${port}/ws`);const events=[];client.on('message',raw=>events.push(JSON.parse(raw)));await once(client,'open');
 const send=event=>client.send(JSON.stringify(event));
 const until=async predicate=>{for(let i=0;i<100;i++){const found=events.find(predicate);if(found)return found;await wait(30);}throw new Error('Expected event missing: '+JSON.stringify(events.slice(-3)));};
 send({type:'mic_start'});await until(e=>e.type==='gradium_ready');
 send({type:'text',text:'Hello'});
 const reply=await until(e=>e.type==='voice_reply');assert.match(reply.text,/not connected/);await until(e=>e.type==='voice_audio');
 events.length=0;send({type:'speech_start'});await until(e=>e.type==='voice_interrupted');
 sidecar.send(JSON.stringify({type:'voice_audio',audio:'AAA=',sampleRate:48000}));await wait(150);assert.ok(!events.some(e=>e.type==='voice_audio'),'Late audio must be blocked');
 sidecar.send(JSON.stringify({type:'voice_turn',transcript:'What can you do?',interim:false,acoustics:null,source:'GRADIUM'}));
 await until(e=>e.type==='voice_reply');await until(e=>e.type==='voice_audio');
 assert.ok(voiceEvents.some(e=>e.type==='interrupt'));assert.ok(voiceEvents.filter(e=>e.type==='speak').length>=2);
 console.log('PASS: typed/spoken replies, speech interruption, late audio suppression, next-turn recovery. Local doubles only.');
} catch(error){console.error(logs);throw error;}
finally{client?.terminate();for(const ws of voice.clients)ws.terminate();voice.close();robot.close();child.kill('SIGTERM');await Promise.race([once(child,'exit'),wait(3000)]);if(child.exitCode===null)child.kill('SIGKILL');}
