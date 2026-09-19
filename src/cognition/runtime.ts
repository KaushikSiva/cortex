import {appendFile,mkdir} from 'node:fs/promises';
import {z} from 'zod';
import fixtures from '../../fixtures/voice.json';
import {behaviorPolicy,defaultPolicy,VoiceMessage,vocalState} from '../emotion/voicePolicy';
import {MujocoBackend} from '../robot/backend';
import {SafetyGovernor} from '../robot/safety/SafetyGovernor';
import {deterministicReflex,jevDecision,stopWords} from '../integrations/jev';
import {plan,validateTool,requestsMemoryNavigation,validateMemoryFollowup} from '../integrations/sambanova';
import {VisualMemory} from '../integrations/memories';
import {LocalExecutionAdapter,EdgeOneExecutionAdapter} from '../integrations/edgeone';
import {Timing} from '../telemetry';
import type {Snapshot,ToolCall,Trace} from '../types';
export class CortexRuntime{
 readonly robot=new MujocoBackend();readonly safety=new SafetyGovernor(this.robot);readonly memory=new VisualMemory();timing=new Timing();
 epoch=0;clientBeat=0;private activeAt=new Map<string,number>();private pending:ToolCall[]=[];private confirmationHold=false;private settledTicks=0;private pollBusy=false;
 state:Snapshot={inputSource:'FIXTURE',mode:process.env.CORTEX_MODE==='REAL'?'REAL':'DEMO',phase:'READY',robot:null,vocal:null,policy:defaultPolicy,traces:[],metrics:[],providers:{PIPECAT:{mode:'OFFLINE',active:false},GRADIUM:{mode:process.env.GRADIUM_API_KEY?'READY':'DEMO',active:false},SAMBA:{mode:process.env.SAMBANOVA_API_KEY?'READY':'DEMO',active:false},MEMORIES:{mode:process.env.MEMORIES_API_KEY?'READY':'DEMO',active:false},JEV:{mode:process.env.JEV_API_KEY?'READY':'LOCAL',active:false},EDGEONE:{mode:process.env.EDGEONE_EXECUTION_URL?'READY':'LOCAL',active:false},ROBOT:{mode:'OFFLINE',active:false}},plan:[],memory:null,response:'Ready when you are.',reflex:'HOLD',error:null,pendingConfirmation:false,history:[]};
 constructor(private publish:(s:Snapshot)=>void){}
 trace(component:string,message:string,durationMs?:number){const provider=({REFLEX:'JEV',EXECUTION:'EDGEONE'} as Record<string,string>)[component]??component;if(this.state.providers[provider]){this.activeAt.set(provider,Date.now());this.state.providers[provider].active=true;}const event:Trace={id:crypto.randomUUID(),at:Date.now(),component,message,durationMs};this.state.traces=[event,...this.state.traces].slice(0,100);void this.persist('trace',event).catch(()=>{});}
 async persist(kind:string,data:unknown){await mkdir('.data',{recursive:true});await appendFile('.data/events.jsonl',JSON.stringify({kind,receivedAt:Date.now(),data})+'\n');}
 emit(){this.state.metrics=this.timing.metrics(this.state.mode==='DEMO');this.publish(this.state);}
 fail(error:unknown){this.state.error=error instanceof Error?error.message:String(error);this.trace('SYSTEM',this.state.error);this.emit();}
 async poll(){
  if(this.pollBusy)return;this.pollBusy=true;for(const [name,at] of this.activeAt)if(name!=='ROBOT'&&Date.now()-at>1600)this.state.providers[name].active=false;
  try{
   const s=await this.robot.getState();this.state.robot=s;this.state.providers.ROBOT={mode:'LIVE',active:s.status==='moving'};
   if(Date.now()-this.clientBeat<1000)await this.robot.heartbeat();
   if(this.state.pendingConfirmation)this.state.phase='AWAITING CONFIRMATION';else if(s.status==='moving')this.state.phase='MOVING';
   else if(s.status==='stopped')this.state.phase='STOPPED';
   else if(s.status==='error')this.state.phase='ERROR';
   else if(this.state.phase==='MOVING')this.state.phase='READY';
   if(this.timing.marks.has('stop_start')&&!this.timing.marks.has('robot_settled')){
    this.settledTicks=s.velocity<.08?this.settledTicks+1:0;
    if(this.settledTicks>=3){this.timing.mark('robot_settled');this.trace('ROBOT','Measured base speed below 0.08 m/s for 3 telemetry samples');}
   }
  }catch{this.state.providers.ROBOT={mode:'OFFLINE',active:false};if(this.state.robot?.status==='moving'){this.safety.latched=true;this.epoch++;}this.state.robot=null;}
  finally{this.pollBusy=false;this.emit();}
 }
 async stop(reason='User stop',preserveTiming=false){
  if(!preserveTiming)this.timing.clear();
  this.epoch++;this.pending=[];this.confirmationHold=false;this.state.pendingConfirmation=false;this.state.reflex='STOP';this.timing.mark('stop_start');this.timing.marks.delete('robot_settled');this.settledTicks=0;
  this.timing.mark('robot_command_sent');await this.safety.stop();this.timing.mark('robot_acknowledged');this.state.phase='STOPPED';this.state.response='Stopped.';this.trace('REFLEX',reason);this.trace('ROBOT','stop() acknowledged');this.emit();
 }
 async reset(){this.epoch++;this.pending=[];this.confirmationHold=false;this.state.pendingConfirmation=false;await this.safety.reset();this.state.phase='READY';this.state.error=null;this.state.response='Reset. Same words, a different voice.';this.state.policy=defaultPolicy;this.state.vocal=null;this.timing.clear();this.state.plan=[];this.trace('ROBOT','reset() · HOME');this.emit();}
 async gradium(raw:unknown){
  void this.persist('gradium_raw',raw).catch(()=>{});
  const event=raw as {type?:string};
  if(event.type==='interruption'){this.trace('GRADIUM','User interruption event');return;}
  if(event.type==='error'){this.fail('Gradium returned an error; inspect raw event log.');return;}
  const result=VoiceMessage.safeParse(raw);if(!result.success)return;
  if(result.data.interim&&!stopWords(result.data.transcript))return;
  this.state.inputSource='MICROPHONE';await this.processVoice(raw);
 }
 async fixture(name:string){
  if(process.env.CORTEX_MODE==='REAL'||this.state.providers.GRADIUM.mode==='LIVE')throw new Error('Disable live microphone before running DEMO fixtures');
  if(!(name in fixtures)||name==='_provenance')throw new Error('Unknown fixture');
  this.state.mode='DEMO';this.state.inputSource='FIXTURE';this.state.providers.GRADIUM.mode='DEMO';this.timing.clear();await this.processVoice(fixtures[name as keyof typeof fixtures]);
 }
 async processVoice(raw:unknown){
  const v=vocalState(raw);
  if(this.state.inputSource!=='TYPED')this.timing.mark('gradium_voice_received');
  // STOP must precede confirmation as well as model calls: “yes, wait, stop”
  // cancels the held mission and must never release its motion latch.
  if(stopWords(v.transcript)){
   this.state.vocal=v;this.state.policy=behaviorPolicy(v);
   this.trace(this.state.inputSource==='TYPED'?'INPUT':'GRADIUM','Stop transcript received');
   this.timing.mark('reflex_decision');await this.stop('Speech stop · bypassed confirmation and planner',true);return;
  }
  if(this.state.pendingConfirmation&&/^\s*(yes|please proceed|go ahead|confirm)\b/i.test(v.transcript)){
   const epoch=this.epoch;const pending=this.pending;this.pending=[];this.state.pendingConfirmation=false;
   // Keep the original cautious policy when the user consents.
   if(this.confirmationHold){this.confirmationHold=false;await this.safety.resume();}
   for(const call of pending)await this.execute(call,epoch,true);this.emit();return;
  }
  this.state.vocal=v;this.state.policy=behaviorPolicy(v);this.state.error=null;this.state.providers.GRADIUM.active=true;
  this.trace(this.state.inputSource==='TYPED'?'INPUT':'GRADIUM',this.state.inputSource==='TYPED'?'No acoustic input · neutral behavioral defaults':`${this.state.providers.GRADIUM.mode} · transcript + local acoustic cues received`);
  const input={transcript:v.transcript,distance_to_person:Math.hypot((this.state.robot?.pose.x??-3)-3,this.state.robot?.pose.y??0),path_blocked:(this.state.robot?.nearestObstacle??10)<.32,user_urgency:v.derived.urgency,user_hesitation:v.derived.hesitation,current_speed:this.state.robot?.velocity??0};
  // Synchronous stop detection runs before ANY model await, on interim transcripts too.
  const hard=deterministicReflex(input);
  if(hard==='STOP'){this.timing.mark('reflex_decision');await this.stop('Speech stop · bypassed planner',true);return;}
  const epoch=++this.epoch;this.pending=[];this.state.pendingConfirmation=false;
  const reflex=await jevDecision(input);if(epoch!==this.epoch)return;
  this.timing.mark('reflex_decision');this.state.reflex=reflex.action;this.state.providers.JEV={mode:reflex.source.startsWith('LIVE')?'LIVE':'LOCAL',active:true};this.trace('REFLEX',reflex.action+' · '+reflex.source);
  if(['STOP','HOLD'].includes(reflex.action)){await this.stop(reflex.action,true);return;}
  if(reflex.action==='REQUEST_CONFIRMATION')this.state.policy.requireConfirmation=true;
  if(reflex.action==='SLOW_DOWN')this.state.policy={...this.state.policy,maxSpeed:.3,approachSpeed:.2};
  if(/^\s*continue\b/i.test(v.transcript)&&this.safety.latched){await this.safety.resume();if(epoch!==this.epoch)return;}
  this.state.phase='THINKING';this.state.providers.SAMBA.active=true;this.emit();
  const live=!!process.env.SAMBANOVA_API_KEY;
  let calls:ToolCall[];
  try{calls=await plan(v.transcript,{memory:this.state.memory,policy:this.state.policy,robot:this.state.robot},live);this.state.providers.SAMBA.mode=live?'LIVE':'DEMO';}
  catch(e){this.state.providers.SAMBA.mode='OFFLINE';this.trace('SAMBA','Unavailable · bounded local command fallback');if(/come here/i.test(v.transcript))calls=[{name:'navigate_to',arguments:{location:'PERSON'}}];else throw e;}
  finally{this.state.providers.SAMBA.active=false;}
  if(epoch!==this.epoch)return;
  this.timing.mark('intent_ready');this.state.plan=calls;this.trace('SAMBA',calls.map(c=>c.name+'('+Object.values(c.arguments).join(', ')+')').join(' → '));
  for(const call of calls){if(epoch!==this.epoch)return;await this.execute(call,epoch);}
  this.state.history=[...this.state.history,{label:v.derived.hesitation>.5?'Hesitant':v.derived.urgency>.6?'Urgent':'Calm',speed:this.state.policy.maxSpeed,priority:this.state.policy.priority,space:this.state.policy.personalSpaceMeters}].slice(-5);
  this.emit();
 }
 async execute(raw:ToolCall,epoch:number,confirmed=false){
  const call=validateTool(raw);if(epoch!==this.epoch)return;
  switch(call.name){
   case 'stop':await this.stop();break;
   case 'navigate_to':case 'return_home':{
    const location=call.name==='return_home'?'HOME':String(call.arguments.location);
    if(this.state.policy.requireConfirmation&&!confirmed){await this.safety.stop();if(epoch!==this.epoch)return;this.confirmationHold=true;this.pending.push(call);this.state.pendingConfirmation=true;this.state.phase='AWAITING CONFIRMATION';this.state.response='I’ll give you more space. Shall I approach?';this.trace('SAFETY','Holding for confirmation · 2.0 m personal space');break;}
    this.timing.mark('robot_command_sent');await this.safety.navigate(location,this.state.policy,Date.now(),confirmed);this.timing.mark('robot_acknowledged');this.state.phase='MOVING';this.state.response=this.state.policy.responseVerbosity==='minimal'?'On my way.':'I’m coming over. I’ll stop at a comfortable distance.';this.trace('ROBOT',`navigate(${location}) · ${this.state.policy.maxSpeed.toFixed(2)} m/s ceiling`);break;
   }
   case 'search_memory':{
    this.state.phase='REMEMBERING';this.state.providers.MEMORIES.active=true;this.timing.mark('memory_query_start');this.emit();
    const live=!!process.env.MEMORIES_API_KEY;let result;
    try{result=await this.memory.searchVisualMemory(String(call.arguments.query),live);this.state.providers.MEMORIES.mode=live?'LIVE':'DEMO';}finally{this.state.providers.MEMORIES.active=false;}
    if(epoch!==this.epoch)return;
    this.timing.mark('memory_response');this.state.memory=result[0]??null;this.state.response=result[0]?`I saw it ${result[0].location}.`:'No indexed sighting yet. Capture a scene memory first.';this.trace('MEMORIES',result[0]?`Retrieved ${result[0].object} → ${result[0].waypoint} · ${result[0].source}`:'No matching evidence');this.state.phase='READY';
    const transcript=this.state.vocal?.transcript??'';
    if(result[0]&&requestsMemoryNavigation(transcript)){
     this.state.phase='THINKING';this.emit();
     const followup=await plan(transcript,{memory:result[0],memoryResolved:true,policy:this.state.policy,robot:this.state.robot},!!process.env.SAMBANOVA_API_KEY);
     if(epoch!==this.epoch)return;
     // Evidence constrains this round; model output cannot choose another location
     // or recurse through more memory queries after the one bounded retrieval.
     const resolved=validateMemoryFollowup(followup,result[0].waypoint);
     this.state.plan=[...this.state.plan,...resolved];this.trace('SAMBA',`Memory evidence ${result[0].id} → ${result[0].waypoint}`);
     for(const next of resolved)await this.execute(next,epoch);
    }
    break;
   }
   case 'set_speed':await this.safety.setSpeed(Number(call.arguments.speed));this.state.policy.maxSpeed=Math.min(Number(call.arguments.speed),.9);break;
   case 'speak':this.state.response=String(call.arguments.message);this.state.phase='READY';break;
   case 'look_at':this.state.response='Head motion is unavailable on this 12-DoF walking model.';break;
   case 'inspect_scene':this.state.response=JSON.stringify(await this.robot.getState());break;
  }
 }
 async command(raw:unknown){
  const m=z.object({type:z.string(),name:z.string().optional(),text:z.string().max(500).optional(),image:z.string().max(8_000_000).optional()}).parse(raw);
  this.state.error=null;
  switch(m.type){
   case 'heartbeat':this.clientBeat=Date.now();return;
   case 'fixture':await this.fixture(m.name??'');return;
   case 'stop':await this.stop();return;
   case 'reset':await this.reset();return;
   case 'resume':await this.safety.resume();this.state.phase='READY';this.state.response='Ready to continue.';break;
   case 'confirm':{const epoch=this.epoch;const pending=this.pending;this.pending=[];this.state.pendingConfirmation=false;if(this.confirmationHold){this.confirmationHold=false;await this.safety.resume();}for(const call of pending)await this.execute(call,epoch,true);break;}
   case 'text':{
    // Typed commands have NO acoustic expression. They are explicitly labeled local input.
    this.timing.clear();this.state.inputSource='TYPED';this.trace('INPUT','Typed command · no vocal expression');
    if(stopWords(m.text??'')){await this.stop('Typed stop');return;}
    if(/take me there/i.test(m.text??'')&&!this.state.memory)throw new Error('Retrieve an actual sighting first');
    const raw={type:'voice_turn',transcript:m.text??'',acoustics:null,source:'TYPED'};await this.processVoice(raw);break;
   }
   case 'capture':this.state.memory=await this.memory.remember(m.image??'',!!process.env.MEMORIES_API_KEY);this.trace('MEMORIES','Camera frame saved · operator-labeled backpack at PLANTER');this.state.response='Scene evidence saved. Ask where I saw the backpack.';break;
   case 'healthcheck':{const live=!!process.env.EDGEONE_EXECUTION_URL;const adapter=live?new EdgeOneExecutionAdapter(process.env.EDGEONE_EXECUTION_URL!,process.env.EDGEONE_EXECUTION_TOKEN??''):new LocalExecutionAdapter();await adapter.runHealthCheck();this.state.providers.EDGEONE={mode:live?'LIVE':'LOCAL',active:true};this.trace('EXECUTION','Controller healthcheck passed · '+(live?'EdgeOne':'local'));break;}
   default:throw new Error('Unknown command');
  }
  this.emit();
 }
}
