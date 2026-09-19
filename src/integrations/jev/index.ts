export type ReflexAction='CONTINUE'|'SLOW_DOWN'|'STOP'|'TURN_LEFT'|'TURN_RIGHT'|'HOLD'|'REQUEST_CONFIRMATION';
export type ReflexInput={transcript:string;distance_to_person:number;path_blocked:boolean;user_urgency:number;user_hesitation:number;current_speed:number};
export const stopWords=(s:string)=>/\b(stop|wait|halt|freeze)\b/i.test(s);
export function deterministicReflex(s:ReflexInput):ReflexAction{if(stopWords(s.transcript)||s.path_blocked||s.distance_to_person<.7)return 'STOP';if(s.user_hesitation>.5)return 'REQUEST_CONFIRMATION';if(/\bslow(ly|er)?\b/i.test(s.transcript))return 'SLOW_DOWN';return 'CONTINUE';}
export async function jevDecision(s:ReflexInput):Promise<{action:ReflexAction;source:string;raw?:unknown}>{
 const hard=deterministicReflex(s);if(hard==='STOP'||!process.env.JEV_API_KEY)return {action:hard,source:'LOCAL hard rules'};
 try{
 const r=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:`Bearer ${process.env.JEV_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'jev-latest',state:JSON.stringify(s),questions:{action:{type:'choice',instructions:'Choose a conservative robot reflex. Never choose a turn without obstacle geometry.',criteria:{CONTINUE:'No intervention needed',SLOW_DOWN:'Reduce speed',STOP:'Immediate halt needed',HOLD:'Remain still',REQUEST_CONFIRMATION:'User seems uncertain or distressed'}}}}),signal:AbortSignal.timeout(180)});
 if(!r.ok)throw new Error(`Jev HTTP ${r.status}`);const raw=await r.json();const action=raw.answers?.action?.choice;
 if(!['CONTINUE','SLOW_DOWN','STOP','HOLD','REQUEST_CONFIRMATION'].includes(action))throw new Error('Malformed Jev result');
 // A model cannot relax the conservative deterministic decision.
 return {action:hard==='CONTINUE'?action:hard,source:'LIVE Jev',raw};
 }catch{return {action:hard,source:'LOCAL fallback (Jev unavailable)'};}
}
