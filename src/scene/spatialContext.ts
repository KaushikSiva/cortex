import type {Pose,RobotState} from '../types';
import {waypoints} from '../robot/backend';

export type SceneObject={name:string;x:number;y:number;halfX:number;halfY:number};
// Authored scene knowledge, not camera detections. Collision telemetry overrides these bounds.
const authored:SceneObject[]=[
 {name:'bench',x:-1,y:3.5,halfX:1,halfY:.3},
 {name:'planter',x:2.8,y:2.6,halfX:1,halfY:.7},
 {name:'park_edge',x:0,y:4.55,halfX:12,halfY:.12},
 {name:'south_boundary',x:0,y:-6,halfX:12,halfY:.12},
];
const round=(n:number)=>Math.round(n*100)/100;
export function relativePosition(origin:Pose,target:{x:number;y:number}){
 const dx=target.x-origin.x,dy=target.y-origin.y;
 const forward=dx*Math.cos(origin.yaw)+dy*Math.sin(origin.yaw);
 const left=-dx*Math.sin(origin.yaw)+dy*Math.cos(origin.yaw);
 const bearing=Math.atan2(left,forward);
 const labels=['ahead','ahead-left','left','behind-left','behind','behind-right','right','ahead-right'];
 return {distanceMeters:round(Math.hypot(dx,dy)),forwardMeters:round(forward),leftMeters:round(left),bearingDegrees:round(bearing*180/Math.PI),direction:Math.hypot(dx,dy)<.05?'at your position':labels[(Math.round(bearing/(Math.PI/4))+8)%8]};
}
export function spatialContext(robot:RobotState|null,now=Date.now()){
 const fresh=!!robot&&Number.isFinite(robot.timestamp)&&now-robot.timestamp<1500&&now>=robot.timestamp-100;
 const objects=robot?.sceneObjects?.length?robot.sceneObjects:authored;
 const landmarks=objects.filter(o=>o.name!=='street_boundary').map(object=>{
  const waypoint=object.name==='bench'?'BENCH':object.name==='planter'?'PLANTER':null;
  const endpoints=object.name==='bench'?[{name:'negative-X end',x:object.x-object.halfX,y:object.y},{name:'positive-X end',x:object.x+object.halfX,y:object.y}]:undefined;
  return {
   name:object.name,source:robot?.sceneObjects?.length?'simulator collision geometry':'authored scene geometry',
   center:{x:object.x,y:object.y},bounds:{minX:round(object.x-object.halfX),maxX:round(object.x+object.halfX),minY:round(object.y-object.halfY),maxY:round(object.y+object.halfY)},
   navigationTarget:waypoint,approachPoint:waypoint?waypoints[waypoint]:null,
   fromRobot:fresh?relativePosition(robot!.pose,object):null,
   robotFromObject:fresh&&object.name==='bench'?{reference:'bench front faces negative world Y',...relativePosition({x:object.x,y:object.y,yaw:-Math.PI/2},robot!.pose)}:null,
   distanceToSurfaceMeters:fresh?round(Math.hypot(Math.max(Math.abs(robot!.pose.x-object.x)-object.halfX,0),Math.max(Math.abs(robot!.pose.y-object.y)-object.halfY,0))):null,
   endpoints:endpoints?.map(point=>({...point,fromRobot:fresh?relativePosition(robot!.pose,point):null})),
  };
 });
 return {
  scene:'Painted Ladies, Alamo Square',source:'known simulation map and robot telemetry, not visual memory or live camera detection',
  robotPose:fresh?robot!.pose:null,telemetryFresh:fresh,
  coordinateConvention:'Meters. Yaw 0 faces +X; positive yaw turns left toward +Y. World axes are not surveyed compass directions.',
  landmarks,
  renderedProps:[{name:'backpack',source:'authored rendered prop; not a camera detection',position:{x:2.14,y:1.69},navigationTarget:'PLANTER',fromRobot:fresh?relativePosition(robot!.pose,{x:2.14,y:1.69}):null}],
  houses:{name:'Painted Ladies houses',direction:'positive world Y',approximateNearEdgeY:24,reachable:false,note:'Backdrop across the street; not a walkable destination. A bounded approach within the apron is supported.'},
  navigationTargets:Object.entries(waypoints).map(([name,point])=>({name,point,meaning:name==='HOME'?'robot starting position':name==='BENCH'?'approach point in front of the bench, not the bench center':name==='DOOR'?'legacy named waypoint; no mapped physical door':name==='PERSON'?'fixed approach target; not a tracked human':'named approach target'})),
  walkingBounds:{minX:-5.5,maxX:5.5,minY:-4.5,maxY:3.8},
 };
}
