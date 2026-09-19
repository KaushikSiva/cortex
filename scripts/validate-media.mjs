import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile),file='public/media/CORTEX-demo-indian.mp4';
const {stdout}=await run('ffprobe',['-v','error','-show_entries','format=duration,size:stream=codec_name,codec_type,width,height,sample_rate,channels','-of','json',file]);
const probe=JSON.parse(stdout),visual=probe.streams.find(s=>s.codec_type==='video');
assert.equal(visual.width,1920);assert.equal(visual.height,1080);assert.ok(probe.streams.some(s=>s.codec_type==='audio'));
await run('ffmpeg',['-v','error','-i',file,'-f','null','-']);
const {stderr}=await run('ffmpeg',['-hide_banner','-i',file,'-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-'],{maxBuffer:2_000_000});
const audio=JSON.parse(stderr.slice(stderr.lastIndexOf('{'),stderr.lastIndexOf('}')+1));
const narration=JSON.parse(await readFile('public/media/CORTEX-demo-indian-narration.json','utf8'));
const overlaps=narration.chapters.filter(c=>c.spokenEnd>c.chapterEnd+.02);assert.equal(overlaps.length,0);
const pdf=await readFile('public/media/CORTEX-pitch.pdf');const pages=(pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length;assert.equal(pages,5);
const browser=await chromium.launch({channel:'chrome',headless:true});let playback;
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.CORTEX_TEST_URL??'http://localhost:3000')+'/demo.html',{waitUntil:'networkidle'});
 await page.locator('video').evaluate(async v=>{v.muted=true;v.textTracks[0].mode='showing';await v.play();});
 await page.waitForFunction(()=>document.querySelector('video').currentTime>.3&&document.querySelector('video').textTracks[0].cues?.length===12);
 playback={result:await page.locator('video').evaluate(v=>({source:v.currentSrc,duration:v.duration,width:v.videoWidth,height:v.videoHeight,playedTo:v.currentTime,captionLabel:v.textTracks[0].label,cues:v.textTracks[0].cues.length,error:v.error})),errors};
 assert.deepEqual(errors,[]);assert.equal(playback.result.error,null);
}finally{await browser.close();}
const result={file,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),probe,browserPlayback:playback,audioMeasured:{integratedLufs:Number(audio.input_i),truePeakDbtp:Number(audio.input_tp),loudnessRangeLu:Number(audio.input_lra)},chapters:narration.chapters.length,maxAudioTempo:Math.max(...narration.chapters.map(c=>c.tempo)),chapterOverlaps:overlaps.length,fullDecode:'ffmpeg -v error -i '+file+' -f null -; exit 0',pitch:{pages,sha256:createHash('sha256').update(pdf).digest('hex')},limits:'Generated Rishi en-IN narration over fresh current application footage. Synthetic policy fixtures and local planning/memory, not a human-microphone or cloud-planning validation. Authored 3D study; photorealism not passed.'};
await writeFile('docs/indian-video-validation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
