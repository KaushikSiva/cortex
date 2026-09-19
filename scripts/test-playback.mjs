import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const base=process.env.CORTEX_TEST_URL??'http://localhost:3000';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.__audioCounts={started:0,stopped:0};
  const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start=function(...args){window.__audioCounts.started++;return start.apply(this,args)};
  AudioBufferSourceNode.prototype.stop=function(...args){window.__audioCounts.stopped++;return stop.apply(this,args)};
  navigator.mediaDevices.getUserMedia=async()=>new AudioContext().createMediaStreamDestination().stream;
 });
 const state=await(await fetch(base+'/api/status')).json();let socket,epoch=0;
 await page.routeWebSocket('**/ws',ws=>{socket=ws;ws.send(JSON.stringify({type:'snapshot',state}));ws.onMessage(text=>{const m=JSON.parse(text);epoch=m.voiceEpoch;if(m.type==='mic_start')ws.send(JSON.stringify({type:'gradium_ready'}));});});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Connect microphone'}).click();await page.getByText('MIC LIVE',{exact:true}).waitFor();
 const pcm=Buffer.alloc(48000*2*6);for(let i=0;i<pcm.length;i+=2)pcm.writeInt16LE(Math.round(Math.sin(i/2*.028)*8000),i);
 const publish=e=>{socket.send(JSON.stringify({type:'voice_reply',voiceEpoch:e,requestId:'test',text:'Test response'}));socket.send(JSON.stringify({type:'voice_audio',audio:pcm.toString('base64'),sampleRate:48000,voiceEpoch:e,requestId:'test'}));};
 const before=epoch;publish(before);await page.waitForFunction(()=>window.__audioCounts.started===1);
 await page.locator('.stop-button').click();await page.waitForFunction(()=>window.__audioCounts.stopped>=1);
 publish(before);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.__audioCounts.started),1);
 assert.ok(epoch>before);publish(epoch);await page.waitForFunction(()=>window.__audioCounts.started===2);
 await page.getByRole('button',{name:'End microphone'}).click();await page.getByText('MIC OFF',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);const result={oldEpoch:before,newEpoch:epoch,counts:await page.evaluate(()=>window.__audioCounts),errors,scope:'Real browser AudioContext and UI, synthetic silent microphone and routed WebSocket; no provider or robot commands.'};
 await writeFile('docs/playback-browser-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
