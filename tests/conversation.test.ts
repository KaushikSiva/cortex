import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {Conversation} from '../src/cognition/conversation';
import {CortexRuntime} from '../src/cognition/runtime';
import {stopWords} from '../src/integrations/jev';
import type {RobotState} from '../src/types';
const answer=(content:string)=>({choices:[{message:{content}}]});
const call=(name:string,args:unknown)=>({choices:[{message:{content:null,tool_calls:[{id:'call1',type:'function',function:{name,arguments:JSON.stringify(args)}}]}}]});
function mockProvider(replies:unknown[]){
 const requests:Record<string,any>[]=[];
 const request:typeof fetch=async(_url,options)=>{requests.push(JSON.parse(String(options?.body)));const next=replies.shift();assert.ok(next,'unexpected model request');return Response.json(next);};
 return {requests,request};
}
async function configured(work:()=>Promise<void>){const old=process.env.SAMBANOVA_API_KEY;process.env.SAMBANOVA_API_KEY='test-only';try{await work();}finally{if(old===undefined)delete process.env.SAMBANOVA_API_KEY;else process.env.SAMBANOVA_API_KEY=old;}}

test('conversation remembers follow-ups and sends current context',()=>configured(async()=>{
 const fake=mockProvider([answer('I can navigate.'),answer('Navigation means moving to a destination.')]);
 const conversation=new Conversation(()=>({street:'test street'}),fake.request);
 await conversation.reply('What can you do?');await conversation.reply('Explain that.');
 assert.deepEqual(fake.requests[1].messages.slice(1).map((m:any)=>m.content),['What can you do?','I can navigate.','Explain that.']);
 assert.match(fake.requests[0].messages[0].content,/test street/);
 assert.equal(fake.requests[0].tool_choice,undefined);
}));

test('validated teammate tool result is fed back before the spoken answer',()=>configured(async()=>{
 const fake=mockProvider([call('navigate_street',{destination:'library'}),answer('Heading to the library.')]);
 const conversation=new Conversation(()=>({}),fake.request);let executed=0;
 conversation.register('navigate_street',{description:'Navigate',schema:z.object({destination:z.string()}).strict(),execute:async args=>{executed++;assert.equal(args.destination,'library');return {accepted:true,arrived:false};}});
 assert.equal(await conversation.reply('Go to the library.'),'Heading to the library.');
 assert.equal(executed,1);assert.equal(fake.requests[0].tool_choice,'auto');
 const result=fake.requests[1].messages.at(-1);assert.equal(result.role,'tool');assert.deepEqual(JSON.parse(result.content),{accepted:true,arrived:false});
}));

test('malformed and unknown tools never execute and errors reach the model',()=>configured(async()=>{
 const fake=mockProvider([call('navigate_street',{destination:7}),call('shell',{command:'bad'}),answer('I could not start that action.')]);
 const conversation=new Conversation(()=>({}),fake.request);let executed=false;
 conversation.register('navigate_street',{description:'Navigate',schema:z.object({destination:z.string()}).strict(),execute:async()=>{executed=true;}});
 await conversation.reply('Go somewhere');assert.equal(executed,false);
 assert.equal(JSON.parse(fake.requests[1].messages.at(-1).content).ok,false);
 assert.match(fake.requests[2].messages.at(-1).content,/Unknown tool/);
}));

test('interruption suppresses late model output and actions even if fetch ignores abort',()=>configured(async()=>{
 let release!:(r:Response)=>void;
 const conversation=new Conversation(()=>({}),async()=>new Promise(resolve=>{release=resolve;}));let executed=false;
 conversation.register('move',{description:'Move',schema:z.object({}).strict(),execute:async()=>{executed=true;}});
 const pending=conversation.reply('Move');conversation.interrupt();release(Response.json(call('move',{})));
 assert.equal(await pending,null);assert.equal(executed,false);assert.deepEqual(conversation.history,[]);
}));

test('newer turn supersedes an old turn without polluting history',()=>configured(async()=>{
 let release!:(r:Response)=>void;let count=0;
 const conversation=new Conversation(()=>({}),async()=>++count===1?new Promise(resolve=>{release=resolve;}):Response.json(answer('New answer')));
 const first=conversation.reply('Old question');assert.equal(await conversation.reply('New question'),'New answer');
 release(Response.json(answer('Old answer')));assert.equal(await first,null);
 assert.deepEqual(conversation.history.map(m=>m.content),['New question','New answer']);
}));

test('questions preserve navigation, policy, and pending confirmation',async()=>{
 const runtime=new CortexRuntime(()=>{});runtime.persist=async()=>{};
 runtime.state.robot={status:'moving',currentWaypoint:'BENCH'} as RobotState;
 runtime.state.phase='MOVING';runtime.state.pendingConfirmation=true;const policy=runtime.state.policy;const epoch=runtime.epoch;
 runtime.conversation.reply=async()=> 'I am heading to the bench.';
 runtime.robot.stop=async()=>{assert.fail('A question must not stop movement');};
 await runtime.command({type:'text',text:'Where are you going?'});
 assert.equal(runtime.epoch,epoch);assert.equal(runtime.state.phase,'MOVING');assert.equal(runtime.state.policy,policy);assert.equal(runtime.state.pendingConfirmation,true);
 assert.equal(runtime.state.response,'I am heading to the bench.');
});

test('STOP cancels conversation before dispatching robot stop',async()=>{
 const runtime=new CortexRuntime(()=>{});runtime.persist=async()=>{};const order:string[]=[];
 runtime.conversation.interrupt=()=>{order.push('interrupt');};runtime.robot.stop=async()=>{order.push('stop');};
 await runtime.command({type:'text',text:'Stop!'});assert.deepEqual(order,['interrupt','stop']);
});

test('street questions do not trigger emergency stop, direct requests do',()=>{
 for(const text of ['Where is the bus stop?','Why did you stop?','What is our next stop?','Do not stop','Can you explain the stop button?'])assert.equal(stopWords(text),false,text);
 for(const text of ['Stop!','WAIT! STOP!','Yes, wait! STOP!','Please stop','Can you stop?','Cortex, stop','Go forward, then stop'])assert.equal(stopWords(text),true,text);
});

test('missing model key produces an honest configuration answer without tool execution',async()=>{
 const previous=process.env.SAMBANOVA_API_KEY;delete process.env.SAMBANOVA_API_KEY;
 try{const conversation=new Conversation(()=>({}),async()=>{assert.fail('must not call provider');});assert.match((await conversation.reply('Hi'))!,/not connected/);}finally{if(previous!==undefined)process.env.SAMBANOVA_API_KEY=previous;}
});

test('offline demo resume remains available without a model key',async()=>{
 const previous=process.env.SAMBANOVA_API_KEY;delete process.env.SAMBANOVA_API_KEY;
 try{
  const runtime=new CortexRuntime(()=>{});runtime.persist=async()=>{};
  const snapshot={pose:{x:0,y:0,yaw:0},velocity:0,qpos:Array(19).fill(0),status:'idle',timestamp:Date.now(),nearestObstacle:3,estop:false,currentWaypoint:'BENCH'} as RobotState;
  runtime.state.robot=snapshot;
  const actions:string[]=[];runtime.robot.resume=async()=>{actions.push('resume');};runtime.robot.getState=async()=>snapshot;runtime.robot.turn=async yaw=>{snapshot.pose.yaw=yaw;};runtime.robot.navigate=async(_target,policy,waypoint)=>{actions.push(waypoint);assert.equal(policy.maxSpeed,.3);};
  await runtime.command({type:'text',text:'Continue, but slowly.'});assert.deepEqual(actions,['BENCH']);
 }finally{if(previous!==undefined)process.env.SAMBANOVA_API_KEY=previous;}
});

test('asking a question preserves the active keyboard lease',async()=>{
 const runtime=new CortexRuntime(()=>{});runtime.persist=async()=>{};
 runtime.manualSession='held-key-session';runtime.state.phase='MOVING';
 runtime.robot.hold=async()=>{assert.fail('Question released the held key');};
 runtime.conversation.reply=async()=> 'You are walking forward.';
 const epoch=runtime.epoch;await runtime.command({type:'text',text:'What are you doing?'});
 assert.equal(runtime.manualSession,'held-key-session');assert.equal(runtime.epoch,epoch);assert.equal(runtime.state.phase,'MOVING');
});

test('live conversation exposes new motion tools and executes the shared turn/walk path',()=>configured(async()=>{
 const fake=mockProvider([call('walk',{direction:'right',meters:.5}),answer('Walking right half a meter.')]);
 const previous=globalThis.fetch;globalThis.fetch=fake.request;
 try{
  const runtime=new CortexRuntime(()=>{});runtime.persist=async()=>{};
  const snapshot={pose:{x:0,y:0,yaw:0},velocity:0,qpos:Array(19).fill(0),status:'idle',timestamp:Date.now(),nearestObstacle:3,estop:false} as RobotState;
  runtime.robot.getState=async()=>snapshot;const actions:string[]=[];
  runtime.robot.turn=async yaw=>{snapshot.pose.yaw=yaw;actions.push('turn');};
  runtime.robot.walk=async(yaw,meters)=>{assert.equal(yaw,-Math.PI/2);assert.equal(meters,.5);actions.push('walk');};
  await runtime.command({type:'text',text:'Take a half-meter step to your right.'});
  assert.deepEqual(actions,['turn','walk']);assert.equal(runtime.state.plan[0].name,'walk');
  for(const name of ['walk','turn','walk_to'])assert.ok(fake.requests[0].tools.some((t:any)=>t.function.name===name&&t.function.description));
 }finally{globalThis.fetch=previous;}
}));

test('named destination button executes without a conversation provider',async()=>{
 const runtime=new CortexRuntime(()=>{});runtime.persist=async()=>{};
 runtime.conversation.reply=async()=>{assert.fail('A destination button must use the shared motion executor');};
 runtime.motionReflex=async()=>true;let target='';runtime.motion.walkTo=async name=>{target=name;};
 await runtime.command({type:'tool',name:'walk_to',arguments:{target:'BENCH'}});assert.equal(target,'BENCH');
});

test('stop during an awaited turn cannot be overwritten by its completion',async()=>{
 const runtime=new CortexRuntime(()=>{});runtime.persist=async()=>{};runtime.motionReflex=async()=>true;runtime.robot.stop=async()=>{};
 let release!:()=>void;runtime.motion.turn=async()=>{await new Promise<void>(resolve=>{release=resolve;});return null;};
 const moving=runtime.execute({name:'turn',arguments:{angleDegrees:90}},runtime.epoch);
 await new Promise(resolve=>setImmediate(resolve));await runtime.stop();release();await moving;
 assert.equal(runtime.state.phase,'READY');assert.equal(runtime.state.response,'Stopped.');
});

test('polite move home executes without model or pause-based confirmation',async()=>{
 const runtime=new CortexRuntime(()=>{});runtime.persist=async()=>{};
 runtime.conversation.reply=async()=>{assert.fail('Explicit home command should not ask the model for permission');};
 const state={pose:{x:-1,y:0,yaw:0},velocity:0,status:'idle',timestamp:Date.now(),nearestObstacle:3,estop:false} as RobotState;
 runtime.robot.getState=async()=>state;let target='';runtime.motion.walkTo=async name=>{target=name;};
 await runtime.gradium({type:'voice_turn',transcript:'Okay, can you move home, please?',source:'GRADIUM',acoustics:{rmsDb:-30,peakDb:-20,pitchVariation:.1,pauseRatio:.8,voicedMs:2000}});
 assert.equal(target,'HOME');assert.equal(runtime.state.pendingConfirmation,false);assert.equal(runtime.state.response,'Heading home.');
});

test('stop followed by move home executes immediately without resume',async()=>{
 const runtime=new CortexRuntime(()=>{});runtime.persist=async()=>{};runtime.robot.stop=async()=>{};
 runtime.motionReflex=async()=>true;let target='';runtime.motion.walkTo=async name=>{target=name;};
 runtime.robot.resume=async()=>{assert.fail('No resume handshake should be needed');};
 await runtime.command({type:'stop'});await runtime.command({type:'text',text:'Move home.'});
 assert.equal(target,'HOME');assert.equal(runtime.state.pendingConfirmation,false);assert.equal(runtime.state.response,'Heading home.');
});

test('toward houses faces positive world Y and walks a bounded meter',async()=>{
 const runtime=new CortexRuntime(()=>{});runtime.persist=async()=>{};
 runtime.robot.getState=async()=>({pose:{x:-3,y:0,yaw:0},nearestObstacle:3,velocity:0,status:'idle',estop:false,timestamp:Date.now()} as RobotState);
 const calls:string[]=[];runtime.motion.turn=async angle=>{assert.equal(angle,90);calls.push('turn');return Math.PI/2;};runtime.motion.walk=async(direction,meters)=>{assert.equal(direction,'front');assert.equal(meters,1);calls.push('walk');};
 await runtime.command({type:'text',text:'Okay, can you move towards the houses, please?'});
 assert.deepEqual(calls,['turn','walk']);assert.equal(runtime.state.pendingConfirmation,false);
});


test('new motion replaces the stopped reply before an awaited turn completes',async()=>{
 const runtime=new CortexRuntime(()=>{});runtime.persist=async()=>{};runtime.motionReflex=async()=>true;
 runtime.state.response='Stopped.';let release!:()=>void;
 runtime.motion.turn=async()=>{await new Promise<void>(resolve=>{release=resolve;});return 1;};
 const moving=runtime.execute({name:'turn',arguments:{angleDegrees:90}},runtime.epoch);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(runtime.state.response,'Turning.');assert.equal(runtime.state.phase,'TURNING');
 release();await moving;
});
