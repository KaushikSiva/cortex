import {z} from 'zod';
import type {BehaviorPolicy} from '../../types';
import {SafetyGovernor} from '../../robot/safety/SafetyGovernor';
import {Waypoint,waypoints} from '../../robot/backend';
export const Direction=z.enum(['front','left','right','back']);
export type Direction=z.infer<typeof Direction>;
export const directionDegrees:Record<Direction,number>={front:0,left:90,right:-90,back:180};
export const wrapAngle=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
type Context={active:()=>boolean;confirmed?:boolean;session?:string;onCommand?:()=>void;onAcknowledged?:()=>void;trace:(message:string)=>void};
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
/** The same turn primitive is used by voice, keyboard, directional walk and waypoint walk. */
export class MotionTools{
 constructor(private safety:SafetyGovernor){}
 private async command(context:Context,action:()=>Promise<void>){context.onCommand?.();await action();if(context.active())context.onAcknowledged?.();}
 async turn(angleDegrees:number,policy:BehaviorPolicy,context:Context){
  z.number().finite().min(-180).max(180).parse(angleDegrees);
  const state=await this.safety.backend.getState();if(!context.active())return null;
  const yaw=wrapAngle(state.pose.yaw+angleDegrees*Math.PI/180);
  context.trace(`turn(${angleDegrees.toFixed(1)}°)`);
  if(Math.abs(angleDegrees)<5)return yaw;
  await this.command(context,()=>this.safety.turn(yaw,policy,!!context.confirmed,context.session));
  const started=performance.now();
  while(context.active()){
   const s=await this.safety.backend.getState();if(!context.active())return null;
   if(s.estop||s.status==='error')return null;
   if(s.status==='idle'&&Math.abs(wrapAngle(yaw-s.pose.yaw))<.16)return yaw;
   if(s.status==='idle')return null; // A lease expiry or hold must never launch the following walk.
   if(performance.now()-started>12000){await this.safety.stop();throw new Error('Turn timed out');}
   await delay(60);
  }
  return null;
 }
 async walk(direction:Direction,meters:number,policy:BehaviorPolicy,context:Context){
  Direction.parse(direction);z.number().min(.2).max(3).parse(meters);
  const yaw=await this.turn(directionDegrees[direction],policy,context);if(yaw===null||!context.active())return;
  if(context.session){await this.command(context,()=>this.safety.drive(yaw,policy,context.session!));context.trace(`walk(${direction}) · held key`);}
  else {await this.command(context,()=>this.safety.walk(yaw,meters,policy,!!context.confirmed));context.trace(`walk(${direction}, ${meters.toFixed(1)} m)`);}
 }
 async drive(direction:Direction,policy:BehaviorPolicy,context:Context){
  Direction.parse(direction);if(!context.session)throw new Error('Keyboard lease required');
  await this.walk(direction,1,policy,context);
 }
 async walkTo(target:string,policy:BehaviorPolicy,context:Context){
  const waypoint=Waypoint.parse(target),state=await this.safety.backend.getState();if(!context.active())return;
  const point=waypoints[waypoint];const desired=Math.atan2(point.y-state.pose.y,point.x-state.pose.x);
  const angle=wrapAngle(desired-state.pose.yaw)*180/Math.PI;
  const yaw=await this.turn(angle,policy,context);if(yaw===null||!context.active())return;
  await this.command(context,()=>this.safety.navigate(waypoint,policy,Date.now(),!!context.confirmed));context.trace(`walk_to(${waypoint})`);
 }
}
