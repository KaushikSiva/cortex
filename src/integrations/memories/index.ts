import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
import type {MemoryEvent} from '../../types';
const run=promisify(execFile);
const base='https://api.memories.ai/serve/datalake/v1';
async function encodeSnapshot(input:string,output:string){
 await run(process.env.FFMPEG_PATH||ffmpeg||'ffmpeg',['-hide_banner','-loglevel','error','-y','-loop','1','-i',input,'-t','2','-r','2','-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',output],{timeout:20000});
}

export function assertMemoriesSuccess(raw:unknown){
 if(!raw||typeof raw!=='object')throw new Error('Memories.ai returned an invalid response');
 const body=raw as {success?:boolean;failed?:boolean;error?:{message?:string};msg?:unknown;message?:unknown};
 if(body.success===false||body.failed===true||body.error){
  const message=body.error?.message??(typeof body.msg==='string'?body.msg:typeof body.message==='string'?body.message:'Request rejected');
  throw new Error(`Memories.ai rejected the request: ${message.slice(0,300)}`);
 }
}
export class VisualMemory{
 private events:MemoryEvent[]=[];private loaded=false;private collection?:Promise<string>;
 constructor(private dir=path.join(process.cwd(),'.data'),private request:typeof fetch=fetch,private encode=encodeSnapshot){}
 async load(){if(this.loaded)return;await mkdir(this.dir,{recursive:true});try{this.events=JSON.parse(await readFile(path.join(this.dir,'memory.json'),'utf8'));}catch{}this.loaded=true;}
 private async api(route:string,init:RequestInit={}){
  if(!process.env.MEMORIES_API_KEY)throw new Error('Memories.ai API key missing');
  const response=await this.request(base+route,{...init,headers:{Authorization:process.env.MEMORIES_API_KEY,...init.headers},signal:AbortSignal.timeout(30000)});
  const raw=await response.json();assertMemoriesSuccess(raw);
  if(!response.ok)throw new Error(`Memories.ai HTTP ${response.status}`);
  return raw;
 }
 private getCollection():Promise<string>{
  if(!this.collection)this.collection=this.resolveCollection().catch(e=>{this.collection=undefined;throw e;});
  return this.collection;
 }
 private async resolveCollection(){
  if(process.env.MEMORIES_COLLECTION_ID)return process.env.MEMORIES_COLLECTION_ID;
  await this.load();const config=path.join(this.dir,'memories-collection.json');
  try{const saved=JSON.parse(await readFile(config,'utf8'));if(typeof saved.id==='string')return saved.id as string;}catch{}
  const raw=await this.api('/collections',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'cortex-painted-ladies-memory'},body:JSON.stringify({name:'CORTEX Painted Ladies',enabled_detectors:[],face_recognition_enabled:false})});
  if(typeof raw.id!=='string')throw new Error('Memories.ai returned no collection ID');
  await writeFile(config,JSON.stringify({id:raw.id}));return raw.id as string;
 }
 async remember(image:string,live:boolean){
  await this.load();if(!/^data:image\/png;base64,/.test(image)||image.length>8_000_000)throw new Error('Expected PNG camera frame under 6 MB');
  const id=crypto.randomUUID();const filename=`${id}.png`;const buffer=Buffer.from(image.split(',')[1],'base64');await writeFile(path.join(this.dir,filename),buffer);
  // This annotation is authored scene metadata, not a provider object detection.
  const event:MemoryEvent={id,object:'backpack',location:'beside the planter (authored scene annotation)',waypoint:'PLANTER',timestamp:Date.now(),evidence:`/evidence/${filename}`,source:live?'LIVE':'DEMO'};
  if(live){
   const collection_id=await this.getCollection();const clip=path.join(this.dir,`${id}.mp4`);
   try{
    await this.encode(path.join(this.dir,filename),clip);
    const form=new FormData();form.append('json',JSON.stringify({collection_id,fps:1,captured_at:new Date(event.timestamp).toISOString(),idempotency_key:id,metadata:{title:'CORTEX camera snapshot',custom:{capture_id:id}}}));
    form.append('file',new Blob([await readFile(clip)],{type:'video/mp4'}),`${id}.mp4`);
    const uploaded=await this.api('/videos',{method:'POST',body:form});
    if(typeof uploaded.video_id!=='string'||typeof uploaded.operation!=='string')throw new Error('Memories.ai returned no video or indexing operation ID');
    const deadline=Date.now()+180000;
    while(true){
     const op=await this.api(`/operations/${encodeURIComponent(uploaded.operation)}`);
     if(op.cancelled)throw new Error('Memories.ai indexing was cancelled');
     if(op.done===true)break;
     if(Date.now()>=deadline)throw new Error('Memories.ai indexing timed out; capture is not yet searchable');
     await new Promise(resolve=>setTimeout(resolve,2000));
    }
    event.videoNo=uploaded.video_id;event.raw=uploaded;
   }finally{await unlink(clip).catch(()=>{});}
  }
  this.events.push(event);await writeFile(path.join(this.dir,'memory.json'),JSON.stringify(this.events,null,2));return event;
 }
 async searchVisualMemory(query:string,live:boolean):Promise<MemoryEvent[]>{
  await this.load();if(!live)return this.events.filter(e=>e.source==='DEMO'&&/backpack|bag/i.test(query)).sort((a,b)=>b.timestamp-a.timestamp);
  const collection_id=await this.getCollection();
  const raw=await this.api('/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({collection_id,query,mode:'semantic',targets:['frame_embedding'],top_k:5})});
  if(!Array.isArray(raw.results))throw new Error('Memories.ai returned an invalid search result');
  // Bind returned video IDs to local captures; never fabricate navigation targets from provider prose.
  const ids=new Set<string>(raw.results.map((hit:{video_id?:string;ref?:string})=>hit.video_id??hit.ref?.split('@')[0]).filter((id:unknown)=>typeof id==='string'));
  return this.events.filter(e=>e.source==='LIVE'&&e.videoNo&&ids.has(e.videoNo)).sort((a,b)=>b.timestamp-a.timestamp).map(e=>({...e,raw}));
 }
 async getLastSeen(object:string,live:boolean){return (await this.searchVisualMemory(`most recent ${object} location`,live))[0]??null;}
 async getObjectHistory(object:string,live:boolean){return this.searchVisualMemory(object,live);}
}
