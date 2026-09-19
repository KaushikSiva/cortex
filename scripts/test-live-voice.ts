/** Opt-in paid-provider smoke test. Supply generated/saved mono PCM16 at 16 kHz.
 * Dedicated robot + voice sidecar required; never point this at an operator's robot.
 * Example: MUJOCO_API_URL=http://127.0.0.1:8008 PIPECAT_API_URL=http://127.0.0.1:8007
 * npx tsx scripts/test-live-voice.ts .data/come-here.pcm .data/stop.pcm
 */
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {CortexRuntime} from '../src/cognition/runtime';
if(!process.env.MUJOCO_API_URL||!process.env.PIPECAT_API_URL||!process.argv[2]||!process.argv[3])throw Error('Explicit isolated robot/sidecar URLs and two PCM files required');
// Isolate live Gradium perception from optional inference latency; never claim these are live.
process.env.GENERAL_COMPUTE_API_KEY='';process.env.SAMBANOVA_API_KEY='';process.env.JEV_API_KEY='';process.env.MEMORIES_API_KEY='';
const rt=new CortexRuntime(()=>{});rt.persist=async()=>{};const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const until=async(fn:()=>Promise<boolean>,timeout=20000)=>{const start=Date.now();while(!await fn()){if(Date.now()-start>timeout)throw Error('Live test timed out: '+rt.state.error);await sleep(50)}};
const pcm=await readFile(process.argv[2]),stopPCM=await readFile(process.argv[3]);
const beat=setInterval(()=>{rt.clientBeat=Date.now();void rt.poll()},100);
const runs=[];let ws:WebSocket|null=null;let pending=Promise.resolve();
async function stream(audio:Buffer,scale=1){
 rt.timing.clear();rt.timing.mark('speech_start');ws!.send(JSON.stringify({type:'speech_start'}));
 for(let i=0;i<audio.length;i+=640){const chunk=Buffer.from(audio.subarray(i,i+640));for(let j=0;j+1<chunk.length;j+=2)chunk.writeInt16LE(Math.round(chunk.readInt16LE(j)*scale),j);ws!.send(JSON.stringify({type:'audio',data:chunk.toString('base64')}));await sleep(20)}
 for(let i=0;i<35;i++){ws!.send(JSON.stringify({type:'audio',data:Buffer.alloc(640).toString('base64')}));await sleep(20)}
 rt.timing.mark('speech_end');ws!.send(JSON.stringify({type:'speech_end'}));
}
try{
 for(const [label,scale] of [['moderate intensity',.18],['high intensity',1]] as const){
  await rt.reset();let ready=false;const url=new URL(process.env.PIPECAT_API_URL!);url.protocol='ws:';url.pathname='/voice';
  ws=new WebSocket(url);ws.on('message',raw=>{const event=JSON.parse(String(raw));if(event.type==='voice_ready'){ready=true;rt.state.mode='REAL';rt.state.providers.GRADIUM={mode:'LIVE',active:true};return;}pending=pending.then(()=>rt.gradium(event)).catch(e=>{rt.fail(e)})});
  await until(async()=>ready);await stream(pcm,scale);await until(async()=>(await rt.robot.getState()).status==='moving');await pending;
  const first=await rt.robot.getState() as Awaited<ReturnType<typeof rt.robot.getState>>&{simTime:number};
  await until(async()=>((await rt.robot.getState()) as typeof first).simTime-first.simTime>=3);
  const end=await rt.robot.getState();runs.push({label,transcript:rt.state.vocal?.transcript,acoustics:rt.state.vocal?.acoustics,policy:{...rt.state.policy},simulatedSeconds:(end as typeof first).simTime-first.simTime,distanceMeters:Math.hypot(end.pose.x-first.pose.x,end.pose.y-first.pose.y),height:end.qpos[2]});
  if(scale===1){await stream(stopPCM);await until(async()=>(await rt.robot.getState()).status==='idle'&&/stop/i.test(rt.state.vocal?.transcript??''));await pending;}else await rt.stop('Test reset boundary');
  ws.close();ws=null;await sleep(400);
 }
 assert.equal(runs[0].transcript?.toLowerCase().replace(/\W/g,''),runs[1].transcript?.toLowerCase().replace(/\W/g,''));
 assert.equal(runs[0].policy.maxSpeed,.55);assert.equal(runs[1].policy.maxSpeed,.9);assert.ok(runs[1].distanceMeters>runs[0].distanceMeters*1.15);assert.ok(runs.every(r=>r.height>.6));
 const report={at:new Date().toISOString(),passed:true,provenance:'Real Gradium STT → actual Pipecat → local acoustic policy → deterministic planner/reflex → SafetyGovernor → real MuJoCo dynamics. Generated speech at two amplitudes, not human microphone or emotion validation. General Compute/SambaNova/Jev cloud deliberately disabled in this isolated test.',runs,stop:{transcript:rt.state.vocal?.transcript,status:(await rt.robot.getState()).status,metrics:rt.timing.metrics(false)}};
 await writeFile('docs/live-motion-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{clearInterval(beat);ws?.close();await rt.stop('Live test finished');}
