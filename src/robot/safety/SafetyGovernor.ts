import {z} from 'zod';
import {Waypoint,waypoints,type RobotBackend} from '../backend';
import type {BehaviorPolicy} from '../../types';
const policySchema=z.object({priority:z.number().finite().min(0).max(1),maxSpeed:z.number().finite().nonnegative(),approachSpeed:z.number().finite().nonnegative(),personalSpaceMeters:z.number().finite().min(1.2).max(3),requireConfirmation:z.boolean(),responseVerbosity:z.enum(['minimal','normal']),interruptThreshold:z.number().min(0).max(1)}).strict();
export class SafetyGovernor{
 latched=false;generation=0;
 constructor(readonly backend:RobotBackend){}
 async stop(){this.latched=true;this.generation++;await this.backend.stop();}
 async reset(){this.latched=true;const token=++this.generation;await this.backend.reset();if(this.generation!==token){await this.backend.stop();return;}this.latched=false;}
 async resume(){const token=++this.generation;await this.backend.resume();if(this.generation!==token){await this.backend.stop();return;}this.latched=false;}
 async navigate(waypoint:string,policy:BehaviorPolicy,issuedAt=Date.now(),confirmed=false){
  const token=this.generation;const w=Waypoint.parse(waypoint);const p=policySchema.parse(policy);
  if(this.latched)throw new Error('Emergency stop is latched. Resume explicitly.');
  if(!Number.isFinite(issuedAt)||Math.abs(Date.now()-issuedAt)>2000)throw new Error('Stale motion command');
  if(p.requireConfirmation&&!confirmed)throw new Error('Confirmation required');
  const s=await this.backend.getState();
  if(this.latched||token!==this.generation)throw new Error('Motion superseded by stop');
  if(Math.abs(Date.now()-s.timestamp)>750) {await this.stop();throw new Error('Stale telemetry');}
  if(s.status==='error'||s.estop)throw new Error('Robot is not ready');
  if(s.nearestObstacle<.32) {await this.stop();throw new Error('Obstacle too close');}
  await this.backend.navigate(waypoints[w],{...p,maxSpeed:Math.min(p.maxSpeed,.9),approachSpeed:Math.min(p.approachSpeed,.5)},w);
  if(this.latched||token!==this.generation)await this.backend.stop();
 }
 async setSpeed(speed:number){z.number().finite().nonnegative().parse(speed);if(this.latched)throw new Error('Emergency stop latched');await this.backend.setSpeed(Math.min(speed,.9));}
}
