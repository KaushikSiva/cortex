import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertMemoriesSuccess} from '../src/integrations/memories';
test('HTTP 200 provider failures are not accepted as successful uploads or empty search results',()=>{
 assert.throws(()=>assertMemoriesSuccess({code:'0001',msg:'No static resource api/v1/upload_img.',data:null,success:false,failed:true}),/Memories.ai rejected the request: No static resource/);
 assert.throws(()=>assertMemoriesSuccess(null),/invalid response/);
 assert.doesNotThrow(()=>assertMemoriesSuccess({success:true,data:{videoNo:'evidence'}}));
});

import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {VisualMemory} from '../src/integrations/memories';
const frame='data:image/png;base64,aGVsbG8=';
test('Datalake capture waits for indexing and search binds only provider-returned IDs',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'cortex-memory-'));const key=process.env.MEMORIES_API_KEY;process.env.MEMORIES_API_KEY='test';
 const collection=process.env.MEMORIES_COLLECTION_ID;delete process.env.MEMORIES_COLLECTION_ID;
 const calls:string[]=[];let finish!:(r:Response)=>void;
 const request:typeof fetch=async(url,init)=>{
  const route=String(url).split('/datalake/v1')[1];calls.push(route);
  if(route==='/collections')return Response.json({id:'col_test'});
  if(route==='/videos'){
   assert.ok(init?.body instanceof FormData);assert.equal(JSON.parse(String(init.body.get('json'))).collection_id,'col_test');assert.ok(init.body.get('file') instanceof Blob);
   return Response.json({video_id:'vid_test',operation:'op_test'});
  }
  if(route==='/operations/op_test')return new Promise(r=>{finish=r;});
  assert.equal(route,'/search');const body=JSON.parse(String(init?.body));assert.deepEqual(body.targets,['frame_embedding']);assert.equal(body.query,'backpack');
  return Response.json({results:[{ref:'vid_test@0-2'},{video_id:'vid_unrelated'}]});
 };
 try{
  const memory=new VisualMemory(dir,request,async(_,out)=>{await writeFile(out,'clip');});
  const pending=memory.remember(frame,true);
  while(!finish)await new Promise(r=>setTimeout(r,5));
  await assert.rejects(readFile(path.join(dir,'memory.json')));
  finish(Response.json({done:true,error:null}));const event=await pending;assert.equal(event.videoNo,'vid_test');
  const found=await memory.searchVisualMemory('backpack',true);assert.equal(found.length,1);assert.equal(found[0].id,event.id);
  assert.deepEqual(calls,['/collections','/videos','/operations/op_test','/search']);
  const reloaded=new VisualMemory(dir,request);assert.equal((await reloaded.searchVisualMemory('backpack',true))[0].id,event.id);
  assert.equal(calls.filter(x=>x==='/collections').length,1);
 }finally{if(key===undefined)delete process.env.MEMORIES_API_KEY;else process.env.MEMORIES_API_KEY=key;if(collection===undefined)delete process.env.MEMORIES_COLLECTION_ID;else process.env.MEMORIES_COLLECTION_ID=collection;await rm(dir,{recursive:true,force:true});}
});
test('Datalake operation failures, including insufficient balance, reject success',()=>{
 assert.throws(()=>assertMemoriesSuccess({error:{code:'insufficient_balance',message:'insufficient balance — top up your account to continue'}}),/insufficient balance/);
 assert.throws(()=>assertMemoriesSuccess({done:true,error:{message:'indexing failed'}}),/indexing failed/);
 assert.doesNotThrow(()=>assertMemoriesSuccess({done:false,error:null}));
});
