import {appendFile,mkdir} from 'node:fs/promises';
import {z} from 'zod';
import fixtures from '../../fixtures/voice.json';
import {behaviorPolicy,defaultPolicy,VoiceMessage,vocalState} from '../emotion/voicePolicy';
import {MotionTools,Direction} from './tools/motion';
import {MujocoBackend,Waypoint} from '../robot/backend';
import {SafetyGovernor} from '../robot/safety/SafetyGovernor';
import {deterministicReflex,jevDecision,stopWords} from '../integrations/jev';
import {plan,validateTool,requestsMemoryNavigation,validateMemoryFollowup} from '../integrations/sambanova';
import {VisualMemory} from '../integrations/memories';
import {LocalExecutionAdapter,EdgeOneExecutionAdapter} from '../integrations/edgeone';
import {Conversation} from './conversation';
import {toolSchemas} from '../integrations/sambanova';
import {Timing} from '../telemetry';
import type {Snapshot,ToolCall,Trace} from '../types';
export class CortexRuntime{
 readonly robot=new MujocoBackend();readonly safety=new SafetyGovernor(this.robot);readonly motion=new MotionTools(this.safety);manualSession:string|null=null;manualRenewed=0;readonly memory=new VisualMemory();timing=new Timing();
 epoch=0;clientBeat=0;private activeAt=new Map<string,number>();private pending:ToolCall[]=[];private confirmationHold=false;private settledTicks=0;private pollBusy=false;
 state:Snapshot={inputSource:'FIXTURE',mode:process.env.CORTEX_MODE==='REAL'?'REAL':'DEMO',phase:'READY',robot:null,vocal:null,policy:{...defaultPolicy},traces:[],metrics:[],providers:{PIPECAT:{mode:'OFFLINE',active:false},GRADIUM:{mode:process.env.GRADIUM_API_KEY?'READY':'DEMO',active:false},SAMBA:{mode:process.env.SAMBANOVA_API_KEY?'READY':'DEMO',active:false},MEMORIES:{mode:process.env.MEMORIES_API_KEY?'READY':'DEMO',active:false},JEV:{mode:process.env.JEV_API_KEY?'READY':'LOCAL',active:false},EDGEONE:{mode:process.env.EDGEONE_EXECUTION_URL?'READY':'LOCAL',active:false},ROBOT:{mode:'OFFLINE',active:false}},plan:[],memory:null,response:'Ready when you are.',reflex:'HOLD',error:null,pendingConfirmation:false,history:[]};
 private conversationTurn=0;
 /** Set by the street/navigation integration; return JSON-serializable, observed state. */
 getNavigationContext:()=>unknown=()=>null;
 readonly conversation=new Conversation(()=>({navigation:this.getNavigationContext(),robot:this.state.robot,memory:this.state.memory,pendingConfirmation:this.state.pendingConfirmation,policy:this.state.policy,mission:this.state.plan}));
 constructor(private publish:(s:Snapshot)=>void){
  for(const [name,schema] of Object.entries(toolSchemas)){
   if(name==='speak')continue;
   this.conversation.register(name,{schema,description:({turn:'Turn in place by signed relative degrees: left positive, right negative, back 180.',walk:'Face a robot-relative direction, then walk 0.2 to 3 meters. Turns internally; do not add a separate turn.',walk_to:'Start walking to a known named target. Acceptance does not mean arrival.',inspect_scene:'Read current robot telemetry. This is not camera vision.',search_memory:'Search recorded visual evidence; does not move the robot.',navigate_to:'Start navigation to a known waypoint, only on explicit user request. Accepted does not mean arrived.',return_home:'Start returning home on user request.',set_speed:'Change walking speed on explicit user request.',stop:'Stop the robot.',look_at:'Request head orientation if supported.'} as Record<string,string>)[name],execute:async(args,signal)=>{
    signal.throwIfAborted();
    if(name==='inspect_scene')return {robot:this.state.robot,mission:this.state.plan,pendingConfirmation:this.state.pendingConfirmation};
    if(name==='search_memory'){
     const evidence=await this.memory.searchVisualMemory(String(args.query),!!process.env.MEMORIES_API_KEY);
     signal.throwIfAborted();this.state.memory=evidence[0]??null;return {evidence};
    }
    if(this.manualSession)await this.endManual(this.manualSession);
    signal.throwIfAborted();
    const call={name,arguments:args};
    this.state.policy=this.state.vocal?behaviorPolicy(this.state.vocal):defaultPolicy;
    const epoch=++this.epoch;
    await this.execute(call,epoch);
    signal.throwIfAborted();
    if(['navigate_to','return_home','walk_to','walk','turn'].includes(name))this.state.plan=[call];
    return {accepted:true,response:this.state.response,robot:this.state.robot,pendingConfirmation:this.state.pendingConfirmation};
   }});
  }
  this.conversation.register('resume_navigation',{description:'Resume a stopped journey only when the user explicitly says continue or resume. Optionally resume slowly.',schema:z.object({slowly:z.boolean().optional()}).strict(),execute:async(args,signal)=>{
   signal.throwIfAborted();if(this.state.pendingConfirmation)throw new Error('A mission is awaiting confirmation. Ask the user to say yes or cancel it with stop.');const destination=Waypoint.parse(this.state.robot?.currentWaypoint??'HOME');const epoch=++this.epoch;
   await this.safety.resume();signal.throwIfAborted();
   this.state.policy=args.slowly?{...defaultPolicy,maxSpeed:.3,approachSpeed:.2}:defaultPolicy;
   await this.execute({name:'navigate_to',arguments:{location:destination}},epoch);
   return {accepted:true,response:this.state.response};
  }});
 }
 interruptConversation(){this.conversationTurn++;this.conversation.interrupt();this.state.conversationStatus='idle';this.state.providers.SAMBA.active=false;}
 async converse(transcript:string){
  const turn=++this.conversationTurn;
  this.state.conversationStatus='thinking';this.state.providers.SAMBA.active=true;this.state.error=null;this.emit();
  try{
   const answer=await this.conversation.reply(transcript);
   if(answer===null)return;
   this.state.response=answer;this.state.conversation=[...this.conversation.history];
   this.state.providers.SAMBA.mode=process.env.SAMBANOVA_API_KEY?'LIVE':'OFFLINE';
   this.trace('CONVERSATION','Answered without changing mission state unless an action tool was requested');
   this.emit();
  }finally{if(turn===this.conversationTurn){this.state.providers.SAMBA.active=false;this.state.conversationStatus='idle';this.emit();}}
 }
 trace(component:string,message:string,durationMs?:number){const provider=({REFLEX:'JEV',EXECUTION:'EDGEONE'} as Record<string,string>)[component]??component;if(this.state.providers[provider]){this.activeAt.set(provider,Date.now());this.state.providers[provider].active=true;}const event:Trace={id:crypto.randomUUID(),at:Date.now(),component,message,durationMs};this.state.traces=[event,...this.state.traces].slice(0,100);void this.persist('trace',event).catch(()=>{});}
 async persist(kind:string,data:unknown){await mkdir('.data',{recursive:true});await appendFile('.data/events.jsonl',JSON.stringify({kind,receivedAt:Date.now(),data})+'\n');}
 emit(){this.state.metrics=this.timing.metrics(this.state.mode==='DEMO');this.publish(this.state);}
 fail(error:unknown){this.state.error=error instanceof Error?error.message:String(error);this.trace('SYSTEM',this.state.error);this.emit();}
 async poll(){
  if(this.pollBusy)return;this.pollBusy=true;for(const [name,at] of this.activeAt)if(name!=='ROBOT'&&Date.now()-at>1600)this.state.providers[name].active=false;
  try{
   const s=await this.robot.getState();this.state.robot=s;this.state.providers.ROBOT={mode:'LIVE',active:s.status==='moving'};
   if(Date.now()-this.clientBeat<1000)await this.robot.heartbeat();
   if(this.state.pendingConfirmation)this.state.phase='AWAITING CONFIRMATION';else if(s.status==='moving')this.state.phase=s.motion==='turn'?'TURNING':'MOVING';
   else if(s.status==='stopped')this.state.phase='STOPPED';
   else if(s.status==='error')this.state.phase='ERROR';
   else if(['MOVING','TURNING'].includes(this.state.phase))this.state.phase='READY';
   if(this.timing.marks.has('stop_start')&&!this.timing.marks.has('robot_settled')){
    this.settledTicks=s.velocity<.08?this.settledTicks+1:0;
    if(this.settledTicks>=3){this.timing.mark('robot_settled');this.trace('ROBOT','Measured base speed below 0.08 m/s for 3 telemetry samples');}
   }
  }catch{this.state.providers.ROBOT={mode:'OFFLINE',active:false};if(this.state.robot?.status==='moving'){this.safety.latched=true;this.epoch++;}this.state.robot=null;}
  finally{this.pollBusy=false;this.emit();}
 }
 async stop(reason='User stop',preserveTiming=false){
  this.interruptConversation();
  if(!preserveTiming)this.timing.clear();
  this.epoch++;this.manualSession=null;this.pending=[];this.confirmationHold=false;this.state.pendingConfirmation=false;this.state.reflex='STOP';this.timing.mark('stop_start');this.timing.marks.delete('robot_settled');this.settledTicks=0;
  this.timing.mark('robot_command_sent');await this.safety.stop();this.timing.mark('robot_acknowledged');this.state.phase='STOPPED';this.state.response='Stopped.';this.trace('REFLEX',reason);this.trace('ROBOT','stop() acknowledged');this.emit();
 }
 async reset(){this.interruptConversation();this.conversation.clear();this.state.conversation=[];this.epoch++;this.manualSession=null;this.pending=[];this.confirmationHold=false;this.state.pendingConfirmation=false;await this.safety.reset();this.state.phase='READY';this.state.error=null;this.state.response='Reset. Same words, a different voice.';this.state.policy={...defaultPolicy};this.state.vocal=null;this.timing.clear();this.state.plan=[];this.trace('ROBOT','reset() · HOME');this.emit();}
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
  // Preserve the original offline demo commands; arbitrary questions use conversation.
  const localMotion=/^(?:turn\s+(?:left|right|back|around)(?:\s+(?:by\s+)?\d+(?:\.\d+)?)?|(?:walk|move|go|step)\s+(?:front|forward|forwards|left|right|back|backward|backwards)(?:\s+\d+(?:\.\d+)?\s*(?:meters?|metres?|m))?|(?:walk|go|navigate|head|move)\s+(?:to|towards?)\s+(?:the\s+)?(?:home|person|planter|bench|door))[.!]?$/i.test(v.transcript.trim());
  const localCommand=!process.env.SAMBANOVA_API_KEY&&(localMotion||/^(?:come here|take me there|(?:go|return) home|continue(?:,? but)?(?: slowly)?)[.!]?$/i.test(v.transcript.trim()));
  if(this.state.inputSource!=='FIXTURE'&&!localCommand){
   this.state.vocal=v;await this.converse(v.transcript);return;
  }
  if(this.manualSession)await this.endManual(this.manualSession);
  this.state.vocal=v;this.state.policy=behaviorPolicy(v);this.state.error=null;this.state.providers.GRADIUM.active=true;
  this.trace('GRADIUM',`${this.state.providers.GRADIUM.mode} · transcript + local acoustic cues received`);
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
   case 'navigate_to':case 'walk_to':case 'return_home':case 'turn':case 'walk':{
    if(!await this.motionReflex(epoch))break;
    if(this.state.policy.requireConfirmation&&!confirmed){await this.safety.stop();if(epoch!==this.epoch)return;this.confirmationHold=true;this.pending.push(call);this.state.pendingConfirmation=true;this.state.phase='AWAITING CONFIRMATION';this.state.response='I’ll give you more space. Shall I move?';this.trace('SAFETY','Holding for confirmation · cautious motion');break;}
    const context={active:()=>epoch===this.epoch,confirmed,trace:(m:string)=>this.trace('ROBOT',m)};
    this.timing.mark('robot_command_sent');
    if(call.name==='turn')await this.motion.turn(Number(call.arguments.angleDegrees),this.state.policy,context);
    else if(call.name==='walk')await this.motion.walk(Direction.parse(call.arguments.direction),Number(call.arguments.meters),this.state.policy,context);
    else {const location=call.name==='return_home'?'HOME':String(call.name==='walk_to'?call.arguments.target:call.arguments.location);await this.motion.walkTo(location,this.state.policy,context);}
    if(epoch!==this.epoch)return;
    if(epoch!==this.epoch)return;
    this.timing.mark('robot_acknowledged');this.state.phase=call.name==='turn'?'READY':'MOVING';this.state.response=call.name==='turn'?'Turn complete.':this.state.policy.responseVerbosity==='minimal'?'On my way.':'I’m moving. I’ll keep a comfortable distance.';break;
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
 async motionReflex(epoch:number){
  const robot=await this.robot.getState();if(epoch!==this.epoch)return false;
  const result=await jevDecision({transcript:'motion safety check',distance_to_person:Math.hypot(robot.pose.x-3,robot.pose.y),path_blocked:robot.nearestObstacle<.32,user_urgency:this.state.vocal?.derived.urgency??0,user_hesitation:this.state.vocal?.derived.hesitation??0,current_speed:robot.velocity});
  if(epoch!==this.epoch)return false;
  this.state.reflex=result.action;this.state.providers.JEV={mode:result.source.startsWith('LIVE')?'LIVE':'LOCAL',active:true};this.trace('REFLEX',result.action+' · shared motion gate · '+result.source);
  if(['STOP','HOLD'].includes(result.action)){await this.stop('Motion reflex '+result.action);return false;}
  if(result.action==='SLOW_DOWN')this.state.policy={...this.state.policy,maxSpeed:.3,approachSpeed:.2};
  if(result.action==='REQUEST_CONFIRMATION')this.state.policy.requireConfirmation=true;
  return true;
 }
 async startManual(direction:unknown,session:unknown){
  this.interruptConversation();
  const d=Direction.parse(direction),id=z.string().min(8).max(80).parse(session);
  if(this.safety.latched)throw new Error('Resume or reset before keyboard movement.');
  const epoch=++this.epoch;this.manualSession=id;this.manualRenewed=Date.now();this.pending=[];this.state.pendingConfirmation=false;
  this.state.inputSource='KEYBOARD';this.state.vocal=null;this.state.policy={...defaultPolicy};this.state.error=null;
  await this.safety.hold();if(epoch!==this.epoch)return;
  if(!await this.motionReflex(epoch))return;
  if(this.state.policy.requireConfirmation){await this.endManual(id);throw new Error('Reflex requires confirmation; use a bounded walk command.');}
  this.state.plan=[];this.trace('INPUT',`Keyboard ${d} · renewable 650 ms lease`);this.state.phase='MOVING';this.emit();
  await this.motion.drive(d,this.state.policy,{session:id,active:()=>epoch===this.epoch&&this.manualSession===id&&Date.now()-this.manualRenewed<700,trace:m=>this.trace('ROBOT',m)});this.emit();
 }
 async renewManual(session:unknown){if(typeof session!=='string'||session!==this.manualSession)return;this.manualRenewed=Date.now();await this.robot.renew(session);}
 async endManual(session:unknown){
  if(typeof session!=='string'||session!==this.manualSession)return;
  const epoch=++this.epoch;this.manualSession=null;await this.safety.hold();if(epoch!==this.epoch)return;
  this.state.phase='READY';this.state.response='Movement released.';this.trace('ROBOT','hold() · key released');this.emit();
 }
 async command(raw:unknown){
  const m=z.object({type:z.string(),name:z.string().optional(),text:z.string().max(500).optional(),image:z.string().max(8_000_000).optional(),direction:Direction.optional(),session:z.string().max(80).optional(),arguments:z.record(z.string(),z.unknown()).optional()}).parse(raw);
  this.state.error=null;
  switch(m.type){
   case 'manual_start':await this.startManual(m.direction,m.session);return;
   case 'manual_renew':await this.renewManual(m.session);return;
   case 'manual_end':await this.endManual(m.session);return;
   case 'tool':{
    if(!['turn','walk','walk_to'].includes(m.name??''))throw new Error('Only shared motion tools are accepted here');
    const call=validateTool({name:m.name!,arguments:m.arguments??{}});
    this.interruptConversation();
    if(this.manualSession)await this.endManual(this.manualSession);
    const epoch=++this.epoch;this.state.inputSource='KEYBOARD';this.state.vocal=null;this.state.policy={...defaultPolicy};this.state.plan=[call];
    await this.execute(call,epoch);break;
   }
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
    const raw={type:'voice_turn',transcript:m.text??'',acoustics:null,source:'TYPED'};await this.processVoice(raw);break;
   }
   case 'capture':this.state.memory=await this.memory.remember(m.image??'',!!process.env.MEMORIES_API_KEY);this.trace('MEMORIES','Camera frame saved · operator-labeled backpack at PLANTER');this.state.response='Scene evidence saved. Ask where I saw the backpack.';break;
   case 'healthcheck':{const live=!!process.env.EDGEONE_EXECUTION_URL;const adapter=live?new EdgeOneExecutionAdapter(process.env.EDGEONE_EXECUTION_URL!,process.env.EDGEONE_EXECUTION_TOKEN??''):new LocalExecutionAdapter();await adapter.runHealthCheck();this.state.providers.EDGEONE={mode:live?'LIVE':'LOCAL',active:true};this.trace('EXECUTION','Controller healthcheck passed · '+(live?'EdgeOne':'local'));break;}
   default:throw new Error('Unknown command');
  }
  this.emit();
 }
}
