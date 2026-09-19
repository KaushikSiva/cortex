/** Opt-in actual Gradium calls. Inject generated PCM through the browser's real
 * MediaStream/AudioWorklet, into the real web runtime and isolated MuJoCo.
 * Does not claim a human microphone trial. Set CORTEX_TEST_URL explicitly. */
import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const base=process.env.CORTEX_TEST_URL;
if(!base||new URL(base).port==='3000')throw new Error('Use an explicitly isolated test runtime');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});
let page;
try{
 if(process.env.CORTEX_TEST_TRANSFER==='1'){const owner=await browser.newPage();await owner.goto(base);await expect(owner.getByRole('button',{name:'Walk front',exact:true})).toBeEnabled({timeout:60000});}
 page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  let input,destination;window.__replyChunks=0;
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer?.sampleRate===48000)window.__replyChunks++;return start.apply(this,args)};
  navigator.mediaDevices.getUserMedia=async()=>{input=new AudioContext({sampleRate:16000});await input.resume();destination=input.createMediaStreamDestination();return destination.stream;};
  window.__speak=async audio=>{const bytes=Uint8Array.from(atob(audio),c=>c.charCodeAt(0)),pcm=new Int16Array(bytes.buffer),buffer=input.createBuffer(1,pcm.length,16000);const samples=buffer.getChannelData(0);pcm.forEach((x,i)=>samples[i]=x/32768);const source=input.createBufferSource();source.buffer=buffer;source.connect(destination);await new Promise(resolve=>{source.onended=resolve;source.start();});};
 });
 const state=()=>page.evaluate(()=>fetch('/api/status').then(r=>r.json()));
 const until=async(fn,ms=25000)=>{const start=Date.now();while(!await fn()){if(Date.now()-start>ms)throw new Error('Voice assertion timeout: '+JSON.stringify(await state()));await page.waitForTimeout(100);}};
 await page.goto(base,{waitUntil:'networkidle'});
 if(process.env.CORTEX_TEST_TRANSFER==='1'){await page.getByRole('button',{name:'Use this tab',exact:true}).click();await expect(page.getByRole('button',{name:'Walk front',exact:true})).toBeEnabled();}
 await until(async()=>!!(await state()).robot);
 await page.getByTitle('Reset simulation').click();await until(async()=>(await state()).robot.pose.x< -2.8&&(await state()).robot.status==='idle');
 await page.getByRole('button',{name:'Connect microphone'}).click();await page.getByText('MIC LIVE',{exact:true}).waitFor({timeout:20000});
 const observations=[];
 const say=async(name)=>{const pcm=await readFile('.data/voice-commands/'+name+'.pcm');await page.evaluate(audio=>window.__speak(audio),pcm.toString('base64'));};
 const initial=(await state()).robot.pose;
 await say('forward');await until(async()=>(await state()).robot.motion==='walk');await until(async()=>(await state()).robot.pose.x-initial.x>.25);
 let s=await state();observations.push({command:'forward',transcript:s.vocal?.transcript,plan:s.plan,pose:s.robot.pose});
 expect(s.inputSource).toBe('MICROPHONE');expect(s.providers.GRADIUM.mode).toBe('LIVE');expect(s.plan[0].name).toBe('walk');
 expect(s.robot.status).toBe('moving');await say('stop');await until(async()=>(await state()).robot.status==='idle'&&(await state()).response==='Stopped.');
 s=await state();observations.push({command:'stop while moving',transcript:s.vocal?.transcript,pose:s.robot.pose,metrics:s.metrics});
 await say('right');await until(async()=>(await state()).robot.pose.yaw< -1.3&&(await state()).robot.status==='idle');
 s=await state();observations.push({command:'turn right',transcript:s.vocal?.transcript,plan:s.plan,pose:s.robot.pose});expect(s.plan[0].name).toBe('turn');
 await say('back');await until(async()=>(await state()).robot.motion==='walk'&&(await state()).robot.pose.yaw>1.3);
 s=await state();observations.push({command:'back',transcript:s.vocal?.transcript,plan:s.plan,pose:s.robot.pose});expect(s.plan[0].arguments.direction).toBe('back');
 await say('stop');await until(async()=>(await state()).robot.status==='idle');
 await until(async()=>(await page.evaluate(()=>window.__replyChunks))>0);
 await page.getByRole('button',{name:'End microphone'}).click();expect(errors).toEqual([]);
 const result={at:new Date().toISOString(),passed:true,afterControlTransfer:process.env.CORTEX_TEST_TRANSFER==='1',observations,replyChunks:await page.evaluate(()=>window.__replyChunks),errors,provenance:'Generated Rishi speech → actual browser MediaStream / PCM worklet → live Gradium via Pipecat → shared motion tools → isolated MuJoCo. Actual Gradium TTS reached browser playback. No human microphone or emotional-expression claim; model/Jev cloud disabled for deterministic motion checks.'};
 await writeFile('docs/live-browser-voice-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{if(page)await page.locator('.stop-button').click().catch(()=>{});await browser.close();}
