import {z} from 'zod';
import type {Pose,RobotState,BehaviorPolicy} from '../../types';
export const waypoints={HOME:{x:-3,y:0,yaw:0},PERSON:{x:3,y:0,yaw:0},PLANTER:{x:2,y:1.2,yaw:0},BACKPACK:{x:2,y:1.2,yaw:0},BENCH:{x:-1,y:2.4,yaw:0},DOOR:{x:4,y:-2,yaw:0}};
export const Waypoint=z.enum(['HOME','PERSON','PLANTER','BACKPACK','BENCH','DOOR']);
const stateSchema=z.object({pose:z.object({x:z.number().finite(),y:z.number().finite(),yaw:z.number().finite()}),velocity:z.number().finite(),qpos:z.array(z.number().finite()).length(19),status:z.enum(['idle','moving','stopped','error']),timestamp:z.number().finite(),nearestObstacle:z.number().finite(),estop:z.boolean()}).passthrough();
export interface RobotBackend{navigate(target:Pose,policy:BehaviorPolicy,waypoint:string):Promise<void>;setSpeed(speed:number):Promise<void>;stop():Promise<void>;reset():Promise<void>;getState():Promise<RobotState>;resume():Promise<void>;heartbeat():Promise<void>}
export class MujocoBackend implements RobotBackend{
 constructor(private url=process.env.MUJOCO_API_URL??'http://127.0.0.1:8002'){}
 async request(path:string,body?:unknown){const r=await fetch(this.url+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(1500)});if(!r.ok)throw new Error(`Robot ${path}: ${await r.text()}`);return r.json();}
 async getState(){return stateSchema.parse(await this.request('/state')) as RobotState;}
 async navigate(target:Pose,policy:BehaviorPolicy,waypoint:string){Waypoint.parse(waypoint);await this.request('/navigate',{waypoint,id:crypto.randomUUID(),issuedAt:Date.now(),timeoutMs:25000,speed:policy.maxSpeed,approachSpeed:policy.approachSpeed,personalSpaceMeters:policy.personalSpaceMeters});}
 async setSpeed(speed:number){await this.request('/speed',{speed});}
 async stop(){await this.request('/stop',{});}
 async reset(){await this.request('/reset',{});}
 async resume(){await this.request('/resume',{});}
 async heartbeat(){await this.request('/heartbeat',{});}
}
