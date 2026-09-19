import {test} from 'node:test';
import assert from 'node:assert/strict';
import fixtures from '../fixtures/voice.json';
import {vocalState,behaviorPolicy,defaultPolicy} from '../src/emotion/voicePolicy';
import {SafetyGovernor} from '../src/robot/safety/SafetyGovernor';
import {deterministicReflex} from '../src/integrations/jev';
import {validateTool,plan,validateMemoryFollowup} from '../src/integrations/sambanova';
import {Timing} from '../src/telemetry';
import type {RobotBackend} from '../src/robot/backend';
import type {RobotState,BehaviorPolicy} from '../src/types';
const state=()=>({pose:{x:0,y:0,yaw:0},velocity:0,qpos:Array(19).fill(0),status:'idle',timestamp:Date.now(),nearestObstacle:3,estop:false} as RobotState);
function backend(){let calls:string[]=[];let policy:BehaviorPolicy|undefined;let snapshot=state();const b:RobotBackend={async hold(){calls.push('hold')},async turn(yaw){calls.push('turn');snapshot.pose.yaw=yaw},async walk(){calls.push('walk')},async drive(){calls.push('drive')},async renew(){},async getState(){return snapshot},async navigate(_,p){calls.push('navigate');policy=p},async stop(){calls.push('stop')},async reset(){calls.push('reset')},async resume(){calls.push('resume')},async setSpeed(s){calls.push('speed:'+s)},async heartbeat(){}};return {b,calls,get policy(){return policy},set snapshot(s:RobotState){snapshot=s}};}
test('same transcript, measured acoustics preserved, different physical policies',()=>{const calm=vocalState(fixtures.calm),urgent=vocalState(fixtures.urgent),fear=vocalState(fixtures.fearful);assert.equal(calm.transcript,urgent.transcript);assert.equal(urgent.acoustics?.rmsDb,-16);assert.equal(behaviorPolicy(calm).maxSpeed,.55);assert.equal(behaviorPolicy(urgent).maxSpeed,.9);assert.equal(behaviorPolicy(fear).personalSpaceMeters,2);assert.equal(behaviorPolicy(fear).requireConfirmation,true);});
test('reject malformed acoustic measurements',()=>{assert.throws(()=>vocalState({...fixtures.calm,acoustics:{...fixtures.calm.acoustics,rmsDb:NaN}}));});
test('stop words always win without a provider',()=>{assert.equal(deterministicReflex({transcript:'WAIT! STOP!',distance_to_person:3,path_blocked:false,user_urgency:0,user_hesitation:0,current_speed:.8}),'STOP');});
test('clamps velocity; validates commands and confirmation',async()=>{const f=backend(),g=new SafetyGovernor(f.b);await g.navigate('PERSON',{...defaultPolicy,maxSpeed:4,approachSpeed:3});assert.equal(f.policy?.maxSpeed,.9);assert.equal(f.policy?.approachSpeed,.5);await assert.rejects(g.navigate('UNKNOWN',defaultPolicy));await assert.rejects(g.navigate('PERSON',{...defaultPolicy,maxSpeed:NaN}));await assert.rejects(g.navigate('PERSON',{...defaultPolicy,requireConfirmation:true}));});
test('latched stop rejects navigation until explicit resume',async()=>{const f=backend(),g=new SafetyGovernor(f.b);await g.stop();await assert.rejects(g.navigate('PERSON',defaultPolicy));await g.resume();await g.navigate('PERSON',defaultPolicy);assert.deepEqual(f.calls,['stop','resume','navigate']);});
test('stale telemetry stops, stale motion rejected, obstacles stop',async()=>{const f=backend(),g=new SafetyGovernor(f.b);await assert.rejects(g.navigate('PERSON',defaultPolicy,Date.now()-5000));f.snapshot={...state(),timestamp:Date.now()-3000};await assert.rejects(g.navigate('PERSON',defaultPolicy));assert.equal(g.latched,true);await g.reset();f.snapshot={...state(),nearestObstacle:.1};await assert.rejects(g.navigate('PERSON',defaultPolicy));assert.equal(g.latched,true);});
test('a stop preempts a navigation waiting for telemetry',async()=>{const f=backend();let release!:(s:RobotState)=>void;f.b.getState=()=>new Promise(resolve=>{release=resolve});const g=new SafetyGovernor(f.b);const moving=g.navigate('PERSON',defaultPolicy);await g.stop();release(state());await assert.rejects(moving);assert.deepEqual(f.calls,['stop']);});
test('a stop racing reset cannot be cleared by reset completion',async()=>{const f=backend();let release!:()=>void;f.b.reset=()=>new Promise(r=>{release=r});const g=new SafetyGovernor(f.b);const reset=g.reset();await g.stop();release();await reset;assert.equal(g.latched,true);assert.deepEqual(f.calls,['stop','stop']);});
test('model cannot smuggle arbitrary actions or unknown parameters',()=>{assert.throws(()=>validateTool({name:'execute_shell',arguments:{command:'anything'}}));assert.throws(()=>validateTool({name:'navigate_to',arguments:{location:'PERSON',shell:'something'}}));assert.throws(()=>validateTool({name:'set_speed',arguments:{speed:5}}));});
test('memory navigation requires an actually retrieved location',async()=>{await assert.rejects(plan('Take me there.',{},false));assert.equal((await plan('Take me there.',{memory:{waypoint:'BENCH'}},false))[0].arguments.location,'BENCH');});
test('memory planning cannot redirect from evidence, recurse, or send repeated navigation',()=>{
 const navigate={name:'navigate_to',arguments:{location:'BENCH'}};
 assert.deepEqual(validateMemoryFollowup([navigate],'BENCH'),[navigate]);
 assert.throws(()=>validateMemoryFollowup([navigate],'PLANTER'));
 assert.throws(()=>validateMemoryFollowup([navigate,navigate],'BENCH'));
 assert.throws(()=>validateMemoryFollowup([{name:'search_memory',arguments:{query:'backpack'}}],'BENCH'));
 assert.throws(()=>validateMemoryFollowup([{name:'return_home',arguments:{}}],'BENCH'));
});
test('latency stays unknown until both events were observed',()=>{const t=new Timing();assert.equal(t.elapsed('a','b'),null);t.mark('a');assert.equal(t.elapsed('a','b'),null);t.mark('b');assert.ok(t.elapsed('a','b')!>=0);});
test('slow resume preserves the interrupted memory destination',async()=>{const calls=await plan('Continue, but slowly.',{robot:{currentWaypoint:'PLANTER'}},false);assert.equal(calls[0].arguments.location,'PLANTER');});
test('fearful command stops existing motion before asking for consent',async()=>{
 const {CortexRuntime}=await import('../src/cognition/runtime');const rt=new CortexRuntime(()=>{});rt.persist=async()=>{};const calls:string[]=[];
 rt.state.robot={...state(),status:'moving',currentWaypoint:'PERSON',velocity:.4};rt.robot.stop=async()=>{calls.push('stop')};rt.robot.resume=async()=>{calls.push('resume')};let testYaw=0;rt.robot.getState=async()=>({...state(),pose:{...state().pose,yaw:testYaw}});rt.robot.turn=async yaw=>{testYaw=yaw;};rt.robot.navigate=async()=>{calls.push('navigate')};
 const old=process.env.SAMBANOVA_API_KEY;delete process.env.SAMBANOVA_API_KEY;
 try{await rt.fixture('fearful');assert.equal(rt.state.pendingConfirmation,true);assert.deepEqual(calls,['stop']);await rt.command({type:'confirm'});assert.deepEqual(calls,['stop','resume','navigate']);}finally{if(old)process.env.SAMBANOVA_API_KEY=old;}
});
test('stop in a spoken confirmation cancels the held mission without resuming',async()=>{
 const {CortexRuntime}=await import('../src/cognition/runtime');const rt=new CortexRuntime(()=>{});rt.persist=async()=>{};
 const calls:string[]=[];rt.robot.stop=async()=>{calls.push('stop')};rt.robot.resume=async()=>{calls.push('resume')};let testYaw=0;rt.robot.getState=async()=>({...state(),pose:{...state().pose,yaw:testYaw}});rt.robot.turn=async yaw=>{testYaw=yaw;};rt.robot.navigate=async()=>{calls.push('navigate')};
 rt.state.policy={...defaultPolicy,requireConfirmation:true,personalSpaceMeters:2};
 await rt.execute({name:'navigate_to',arguments:{location:'PERSON'}},rt.epoch);
 assert.equal(rt.state.pendingConfirmation,true);
 await rt.gradium({...fixtures.stop,source:'GRADIUM',interim:true,transcript:'Yes, wait! STOP!'});
 assert.equal(rt.state.pendingConfirmation,false);assert.equal(rt.safety.latched,true);assert.equal(rt.state.phase,'STOPPED');
 await rt.command({type:'confirm'});
 assert.deepEqual(calls,['stop','stop']);assert.equal(rt.state.vocal?.transcript,'Yes, wait! STOP!');
});
test('anxious object mission plans from retrieved evidence and waits for confirmation',async()=>{
 const {CortexRuntime}=await import('../src/cognition/runtime');const rt=new CortexRuntime(()=>{});rt.persist=async()=>{};
 const calls:string[]=[];rt.robot.stop=async()=>{calls.push('stop')};rt.robot.resume=async()=>{calls.push('resume')};let testYaw=0;rt.robot.getState=async()=>({...state(),pose:{...state().pose,yaw:testYaw}});rt.robot.turn=async yaw=>{testYaw=yaw;};rt.robot.navigate=async(_,policy,waypoint)=>{calls.push('navigate:'+waypoint);assert.equal(policy.personalSpaceMeters,2)};
 const event={id:'test-evidence',object:'backpack',location:'beside the bench',waypoint:'BENCH' as const,timestamp:Date.now(),evidence:'/evidence/test.png',source:'DEMO' as const};
 rt.memory.searchVisualMemory=async()=>[event];
 const previous=Object.fromEntries(['SAMBANOVA_API_KEY','MEMORIES_API_KEY','JEV_API_KEY'].map(k=>[k,process.env[k]]));
 for(const key of Object.keys(previous))delete process.env[key];
 try{
  await rt.fixture('anxious_memory');
  assert.equal(rt.state.memory?.id,event.id);assert.equal(rt.state.pendingConfirmation,true);assert.equal(rt.state.policy.personalSpaceMeters,2);
  assert.deepEqual(calls,['stop']);assert.ok(rt.state.plan.some(c=>c.name==='navigate_to'&&c.arguments.location==='BENCH'));
  await rt.command({type:'confirm'});assert.deepEqual(calls,['stop','resume','navigate:BENCH']);
 }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
test('voice directions and targets use the shared bounded motion tools',async()=>{
 assert.deepEqual(await plan('move left 2 meters',{},false),[{name:'walk',arguments:{direction:'left',meters:2}}]);
 assert.deepEqual(await plan('turn right',{},false),[{name:'turn',arguments:{angleDegrees:-90}}]);
 assert.deepEqual(await plan('walk to the planter',{},false),[{name:'walk_to',arguments:{target:'PLANTER'}}]);
 assert.equal((await plan('go back home',{},false))[0].name,'return_home');
 assert.throws(()=>validateTool({name:'walk',arguments:{direction:'front',meters:50}}));
 assert.throws(()=>validateTool({name:'turn',arguments:{angleDegrees:360}}));
});
test('directional and target walking reuse turn before issuing translation',async()=>{
 const {MotionTools}=await import('../src/cognition/tools/motion');const f=backend(),m=new MotionTools(new SafetyGovernor(f.b));const ctx={active:()=>true,trace:()=>{}};
 await m.walk('left',1,defaultPolicy,ctx);assert.deepEqual(f.calls,['turn','walk']);
 f.calls.length=0;await m.walkTo('PERSON',defaultPolicy,ctx);assert.deepEqual(f.calls,['turn','navigate']);
 f.calls.length=0;await m.drive('right',defaultPolicy,{...ctx,session:'test-lease'});assert.deepEqual(f.calls,['turn','drive']);
});
test('cancelled turn never launches the following walk',async()=>{
 const {MotionTools}=await import('../src/cognition/tools/motion');const f=backend();let active=true;
 f.b.turn=async()=>{f.calls.push('turn');active=false};
 await new MotionTools(new SafetyGovernor(f.b)).walk('back',1,defaultPolicy,{active:()=>active,trace:()=>{}});
 assert.deepEqual(f.calls,['turn']);
});
test('turn acknowledgement is recorded before physical heading convergence',async()=>{
 const {MotionTools}=await import('../src/cognition/tools/motion');const f=backend();let turning=false,reads=0,acknowledged=false;
 f.b.turn=async()=>{turning=true};
 f.b.getState=async()=>{if(!turning)return state();reads++;assert.equal(acknowledged,true);return {...state(),status:reads<2?'moving':'idle',pose:{x:0,y:0,yaw:reads<2?.4:Math.PI/2}}};
 await new MotionTools(new SafetyGovernor(f.b)).turn(90,defaultPolicy,{active:()=>true,trace:()=>{},onAcknowledged:()=>{acknowledged=true}});
 assert.equal(reads,2);
});

test('Memories application errors in HTTP 200 cannot masquerade as empty evidence',async()=>{
 const {assertMemoryResponse}=await import('../src/integrations/memories');
 assert.throws(()=>assertMemoryResponse({code:'0001',success:false,failed:true,data:null}));
 assert.throws(()=>assertMemoryResponse({data:[]}));
 assert.doesNotThrow(()=>assertMemoryResponse({code:'0000',success:true,data:[]}));
});
