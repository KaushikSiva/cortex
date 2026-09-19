import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {MemoryEvent} from '../../types';
const dir=path.join(process.cwd(),'.data');
export function assertMemoryResponse(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Malformed Memories.ai response');
 const r=raw as Record<string,unknown>;
 if(!['0000','200'].includes(String(r.code))||r.success===false||r.failed===true)throw new Error('Memories.ai application error '+String(r.code??'missing status').slice(0,32));
 return r;
}
const library=()=>process.env.MEMORIES_LIBRARY_ID??'cortex-painted-ladies';
export class VisualMemory{
 private events:MemoryEvent[]=[]; private loaded=false;
 async load(){if(this.loaded)return;await mkdir(dir,{recursive:true});try{this.events=JSON.parse(await readFile(path.join(dir,'memory.json'),'utf8'));}catch{}this.loaded=true;}
 async remember(image:string,live:boolean){
  await this.load();if(!/^data:image\/png;base64,/.test(image)||image.length>8_000_000)throw new Error('Expected PNG camera frame under 6 MB');
  const id=crypto.randomUUID();const filename=`${id}.png`;const buffer=Buffer.from(image.split(',')[1],'base64');await writeFile(path.join(dir,filename),buffer);
  const event:MemoryEvent={id,object:'backpack',location:'beside the planter',waypoint:'PLANTER',timestamp:Date.now(),evidence:`/evidence/${filename}`,source:live?'LIVE':'DEMO'};
  if(live){
   if(!process.env.MEMORIES_API_KEY)throw new Error('Memories.ai API key missing');
   const form=new FormData();form.append('files',new Blob([buffer],{type:'image/png'}),filename);form.append('unique_id',library());
   const response=await fetch('https://api.memories.ai/serve/api/v1/upload_img',{method:'POST',headers:{Authorization:process.env.MEMORIES_API_KEY},body:form,signal:AbortSignal.timeout(25000)});
   if(!response.ok)throw new Error(`Memories.ai upload HTTP ${response.status}`);const raw=await response.json();assertMemoryResponse(raw);event.raw=raw;
   const data=raw.data;const videoNo=data?.videoNo??data?.[0]?.videoNo;
   if(typeof videoNo!=='string')throw new Error('Upload accepted but no recognized videoNo. Inspect provider response before linking to navigation.');
   event.videoNo=videoNo;
  }
  this.events.push(event);await writeFile(path.join(dir,'memory.json'),JSON.stringify(this.events,null,2));return event;
 }
 async searchVisualMemory(query:string,live:boolean):Promise<MemoryEvent[]>{
  await this.load();if(!live)return this.events.filter(e=>e.source==='DEMO'&&/backpack|bag/i.test(query)).sort((a,b)=>b.timestamp-a.timestamp);
  if(!process.env.MEMORIES_API_KEY)throw new Error('Memories.ai API key missing');
  const response=await fetch('https://api.memories.ai/serve/api/v1/search',{method:'POST',headers:{Authorization:process.env.MEMORIES_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({search_param:query,unique_id:library(),top_k:5}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error(`Memories.ai search HTTP ${response.status}`);const raw=await response.json();assertMemoryResponse(raw);
  // Navigation binds provider evidence IDs to locally captured poses, never generated prose.
  const ids=new Set<string>();function walk(v:unknown){if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if((k==='videoNo'||k==='video_no')&&typeof x==='string')ids.add(x);else walk(x);}}walk(raw);
  return this.events.filter(e=>e.source==='LIVE'&&e.videoNo&&ids.has(e.videoNo)).sort((a,b)=>b.timestamp-a.timestamp).map(e=>({...e,raw}));
 }
 async getLastSeen(object:string,live:boolean){return (await this.searchVisualMemory(`most recent ${object} location`,live))[0]??null;}
 async getObjectHistory(object:string,live:boolean){return this.searchVisualMemory(object,live);}
}
