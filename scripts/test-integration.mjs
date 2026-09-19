import WebSocket from 'ws';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const ws=new WebSocket('ws://localhost:3000/ws');let state;ws.on('message',b=>{const m=JSON.parse(b);if(m.type==='snapshot')state=m.state});await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});
const send=(m)=>ws.send(JSON.stringify(m));const beat=setInterval(()=>send({type:'heartbeat'}),300);
async function until(fn,ms=10000){const start=Date.now();while(!fn()){if(Date.now()-start>ms)throw Error('Timed out: '+JSON.stringify(state));await new Promise(r=>setTimeout(r,50));}}
try{
 await until(()=>state?.robot);send({type:'reset'});await until(()=>state.robot.status==='idle'&&!state.robot.estop);
 send({type:'fixture',name:'calm'});await until(()=>state.robot.status==='moving');assert.equal(state.policy.maxSpeed,.55);await new Promise(r=>setTimeout(r,4000));const calm=state.robot.pose.x;
 send({type:'fixture',name:'stop'});await until(()=>(state.robot.status==='idle'));await until(()=>state.metrics.some(m=>m.name==='Stop → settled'&&m.ms!==null));const stopMetrics=state.metrics;
 send({type:'reset'});await until(()=>!state.robot.estop&&state.robot.status==='idle'&&state.robot.pose.x<-2.8);
 send({type:'fixture',name:'urgent'});await until(()=>state.robot.status==='moving');assert.equal(state.policy.maxSpeed,.9);await new Promise(r=>setTimeout(r,4000));const urgent=state.robot.pose.x;assert.ok(urgent>calm+.5,`${urgent} should exceed ${calm}`);
 send({type:'reset'});await until(()=>state.robot.status==='idle'&&state.robot.pose.x<-2.8);send({type:'fixture',name:'fearful'});await until(()=>state.pendingConfirmation);assert.notEqual(state.robot.status,'moving');send({type:'confirm'});await until(()=>state.robot.status==='moving');assert.equal(state.policy.personalSpaceMeters,2);
 send({type:'stop'});await until(()=>(state.robot.status==='idle'));send({type:'text',text:'Continue, but slowly.'});await until(()=>state.robot.status==='moving');assert.equal(state.policy.maxSpeed,.3);
 send({type:'stop'});await until(()=>(state.robot.status==='idle'));const result={passed:true,calmXAfter4s:calm,urgentXAfter4s:urgent,stopMetrics,tests:['same-word physical difference','fast stop','fearful confirmation','resume slowly'],timestamp:new Date().toISOString()};await writeFile('docs/integration-results.json',JSON.stringify(result,null,2));console.log(result);
}finally{clearInterval(beat);ws.close();}
