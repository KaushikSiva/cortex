import {z} from 'zod';
import type {VocalState,BehaviorPolicy} from '../types';
export const AcousticFeatures=z.object({rmsDb:z.number().finite().min(-100).max(0),peakDb:z.number().finite().min(-100).max(0),pitchVariation:z.number().finite().min(0).max(2),pauseRatio:z.number().finite().min(0).max(1),voicedMs:z.number().finite().min(0).max(120000)}).strict();
// This is a CORTEX event emitted by our Pipecat processor, not a Gradium API shape.
export const VoiceMessage=z.object({type:z.literal('voice_turn'),transcript:z.string().max(4000),interim:z.boolean().optional(),acoustics:AcousticFeatures.nullable(),source:z.enum(['GRADIUM','DEMO','TYPED']),timestamp:z.number().optional()});
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function vocalState(raw:unknown,timestamp=Date.now()):VocalState{
 const e=VoiceMessage.parse(raw),a=e.acoustics;
 const intensity=a?clamp((a.rmsDb+38)/22):0;
 const pitchMovement=a?clamp(a.pitchVariation/.55):0;
 const pauses=a?clamp(a.pauseRatio/.55):0;
 const urgency=a?clamp(.85*intensity+.15*pitchMovement):0;
 const hesitation=a&&a.voicedMs>250?clamp(.85*pauses+.15*pitchMovement):0;
 return {transcript:e.transcript,acoustics:a,expressions:a?[{name:'Vocal intensity',score:intensity},{name:'Pitch movement',score:pitchMovement},{name:'Pause fraction',score:pauses}]:[],derived:{urgency,hesitation,calmness:a?clamp(1-urgency):0},timestamp};
}
export function behaviorPolicy(v:VocalState):BehaviorPolicy{
 const d=v.derived;
 const base={priority:.4,maxSpeed:.55,approachSpeed:.35,personalSpaceMeters:1.2,requireConfirmation:false,responseVerbosity:'normal' as const,interruptThreshold:.35};
 if(d.hesitation>.55)return {...base,priority:.7,maxSpeed:.45,approachSpeed:.2,personalSpaceMeters:2,requireConfirmation:true,responseVerbosity:'minimal',interruptThreshold:.2};
 if(d.urgency>.6)return {...base,priority:.95,maxSpeed:.9,approachSpeed:.5,responseVerbosity:'minimal',interruptThreshold:.2};
 return base;
}
export const defaultPolicy=behaviorPolicy(vocalState({type:'voice_turn',transcript:'',acoustics:null,source:'TYPED'}));
/** Live PCM intensity can select a bounded urgent speed profile. Internal pauses
 * alone are not reliable consent/hesitation evidence: retain the measured raw
 * values in the UI, but never create a live confirmation gate from pauses.
 * This is an acoustic heuristic, not a Gradium emotion classification. */
export function liveMotionPolicy(v:VocalState):BehaviorPolicy{
 if(!v.acoustics||v.acoustics.voicedMs<=250)return {...defaultPolicy};
 return behaviorPolicy({...v,derived:{...v.derived,hesitation:0}});
}
