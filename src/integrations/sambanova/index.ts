import {z} from 'zod';
import type {ToolCall} from '../../types';
import {Waypoint} from '../../robot/backend';
import {Direction} from '../../cognition/tools/motion';
export const toolSchemas={turn:z.object({angleDegrees:z.number().finite().min(-180).max(180)}).strict(),walk:z.object({direction:Direction,meters:z.number().min(.2).max(3).default(1)}).strict(),walk_to:z.object({target:Waypoint}).strict(),search_memory:z.object({query:z.string().min(1).max(200)}).strict(),inspect_scene:z.object({}).strict(),navigate_to:z.object({location:Waypoint}).strict(),look_at:z.object({target:Waypoint}).strict(),set_speed:z.object({speed:z.number().finite().min(0).max(.9)}).strict(),stop:z.object({}).strict(),return_home:z.object({}).strict(),speak:z.object({message:z.string().max(500)}).strict()};
export function validateTool(raw:ToolCall):ToolCall{if(!(raw.name in toolSchemas))throw new Error('Unknown tool');return {name:raw.name,arguments:toolSchemas[raw.name as keyof typeof toolSchemas].parse(raw.arguments)};}
const descriptions={turn:'Turn in place by signed relative degrees: left positive, right negative; 180 faces back. Reused internally by walking.',walk:'Face a robot-relative direction, then walk a bounded distance. Reuses turn internally; do not turn separately for this call.',walk_to:'Walk to a named target using shared turn and navigation primitives, gated by Jev/reflex and SafetyGovernor.',search_memory:'Find previous visual sightings, with evidence.',inspect_scene:'Read current robot telemetry.',navigate_to:'Navigate only to a known waypoint. Use retrieved memory context for references.',look_at:'Request head orientation if supported.',set_speed:'Lower or set the bounded walking speed.',stop:'Latch emergency stop.',return_home:'Return to HOME.',speak:'Explain briefly to the user; do not invent memory.'};
export const requestsMemoryNavigation=(text:string)=>/take me|bring me|really need (it|my|the)|help me find/i.test(text);
export function validateMemoryFollowup(calls:ToolCall[],waypoint:string):ToolCall[]{
 const resolved=calls.map(validateTool);
 if(resolved.filter(c=>['navigate_to','walk_to'].includes(c.name)).length!==1||resolved.some(c=>!['navigate_to','walk_to','speak'].includes(c.name)||(c.name==='navigate_to'&&c.arguments.location!==waypoint)||(c.name==='walk_to'&&c.arguments.target!==waypoint)))throw new Error('Memory plan must navigate only to the retrieved evidence waypoint');
 return resolved;
}
export async function plan(transcript:string,context:unknown,live:boolean):Promise<ToolCall[]>{
 if(!live){
  const retrieved=context as {memoryResolved?:boolean;memory?:{waypoint?:string}};
  if(retrieved.memoryResolved&&requestsMemoryNavigation(transcript)){
   if(!retrieved.memory?.waypoint)throw new Error('No retrieved memory location');
   return [{name:'navigate_to',arguments:{location:retrieved.memory.waypoint}}];
  }
  const turn=transcript.match(/\bturn\s+(left|right|back|around)(?:\s+(?:by\s+)?(\d+(?:\.\d+)?))?/i);
  if(turn){const angle=turn[2]?Number(turn[2]):/back|around/i.test(turn[1])?180:90;return [validateTool({name:'turn',arguments:{angleDegrees:turn[1].toLowerCase()==='right'?-angle:angle}})];}
  if(/\b(?:go|walk|return|head)\s+(?:back\s+)?(?:to\s+)?home\b/i.test(transcript))return [{name:'return_home',arguments:{}}];
  const walk=transcript.match(/(?:\b(?:walk|move|go|step)\s+|^)(front|forward|forwards|left|right|back|backward|backwards)\b/i);
  if(walk){const direction=walk[1].toLowerCase().startsWith('for')?'front':walk[1].toLowerCase().startsWith('back')?'back':walk[1].toLowerCase();const distance=transcript.match(/(\d+(?:\.\d+)?)\s*(?:meters?|metres?|m)\b/i);return [validateTool({name:'walk',arguments:{direction,meters:distance?Number(distance[1]):1}})];}
  if(/backpack/i.test(transcript))return [{name:'search_memory',arguments:{query:'most recent backpack location'}}];
  if(/take me there/i.test(transcript)){const location=(context as {memory?:{waypoint?:string}}).memory?.waypoint;if(!location)throw new Error('No retrieved memory location');return [{name:'navigate_to',arguments:{location}}];}
  const target=transcript.match(/\b(?:walk|go|navigate|head|move)\s+(?:to|towards?)\s+(?:the\s+)?(home|person|planter|bench|door)\b/i);if(target)return [{name:'walk_to',arguments:{target:target[1].toUpperCase()}}];
  if(/home/i.test(transcript))return [{name:'return_home',arguments:{}}];
  if(/continue/i.test(transcript)&&!Waypoint.safeParse((context as {robot?:{currentWaypoint?:string}}).robot?.currentWaypoint??'PERSON').success)return [{name:'speak',arguments:{message:'Choose a direction or a named target to continue.'}}];
  if(/continue/i.test(transcript))return [{name:'navigate_to',arguments:{location:(context as {robot?:{currentWaypoint?:string}}).robot?.currentWaypoint??'PERSON'}}];
  if(/come here/i.test(transcript))return [{name:'navigate_to',arguments:{location:'PERSON'}}];
  return [{name:'speak',arguments:{message:'Try “Come here”, “Where is my backpack?”, or “Stop”.'}}];
 }
 if(!process.env.SAMBANOVA_API_KEY)throw new Error('SambaNova API key missing');
 const tools=Object.entries(toolSchemas).map(([name,schema])=>({type:'function',function:{name,description:descriptions[name as keyof typeof descriptions],parameters:z.toJSONSchema(schema)}}));
 const r=await fetch('https://api.sambanova.ai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.SAMBANOVA_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.SAMBANOVA_MODEL??'Meta-Llama-3.3-70B-Instruct',messages:[{role:'system',content:'You are CORTEX mission planner. Use tools only. turn(angleDegrees) is relative: left positive, right negative, back 180. walk(direction, meters) internally reuses turn; do not add a turn before a directional walk. Use walk_to(target) for explicit named destinations. Keyboard and voice share these exact tools. Search memory before navigating for objects. Never invent sightings. Come here means PERSON. Continue resumes robot.currentWaypoint. Do not navigate for a question asking only where. Requests to take/bring the user there, help find the object, or saying they really need it request navigation after retrieval. If context.memoryResolved is true, search already completed: use only that evidence and its waypoint; do not search again. Otherwise return search_memory alone for an object mission; its result will be provided in the next planning step. Context: '+JSON.stringify(context)},{role:'user',content:transcript}],tools,tool_choice:'required',temperature:.1,max_tokens:600}),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw new Error(`SambaNova HTTP ${r.status}`);const data=await r.json();const calls=data.choices?.[0]?.message?.tool_calls;
 if(!Array.isArray(calls)||calls.length>8)throw new Error('Invalid SambaNova tool plan');
 const validated=calls.map(c=>validateTool({name:c.function.name,arguments:JSON.parse(c.function.arguments)}));
 if(validated.some(c=>c.name==='search_memory')&&validated.length!==1)throw new Error('Memory must be retrieved before planning further actions');
 return validated;
}
