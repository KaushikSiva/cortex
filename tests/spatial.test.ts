import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relativePosition,spatialContext} from '../src/scene/spatialContext';
import type {RobotState} from '../src/types';
const robot=(yaw=0)=>({pose:{x:-3,y:0,yaw},timestamp:Date.now()} as RobotState);
test('landmark bearings rotate with the robot rather than world axes',()=>{
 assert.equal(relativePosition({x:0,y:0,yaw:0},{x:0,y:2}).direction,'left');
 assert.equal(relativePosition({x:0,y:0,yaw:Math.PI/2},{x:0,y:2}).direction,'ahead');
 assert.equal(relativePosition({x:0,y:0,yaw:Math.PI},{x:0,y:2}).direction,'right');
});
test('bench geometry, its approach point, and both endpoints stay distinct',()=>{
 const context=spatialContext(robot());const bench=context.landmarks.find(o=>o.name==='bench')!;
 assert.deepEqual(bench.center,{x:-1,y:3.5});assert.equal(bench.approachPoint?.y,2.4);
 assert.deepEqual(bench.endpoints?.map(p=>p.x),[-2,0]);assert.equal(bench.fromRobot?.distanceMeters,4.03);
 assert.equal(bench.fromRobot?.direction,'ahead-left');assert.equal(bench.robotFromObject?.direction,'ahead-right');
});
test('live collision geometry overrides authored fallback and stale poses give no relative claims',()=>{
 const state=robot();state.sceneObjects=[{name:'bench',x:2,y:0,halfX:1,halfY:.3}];
 assert.equal(spatialContext(state).landmarks[0].fromRobot?.distanceMeters,5);
 state.timestamp-=5000;const context=spatialContext(state);
 assert.equal(context.telemetryFresh,false);assert.equal(context.landmarks[0].fromRobot,null);
 assert.equal(context.landmarks[0].center.x,2);
});
test('map knowledge remains available without any visual memory or robot connection',()=>{
 const context=spatialContext(null);assert.ok(context.landmarks.some(o=>o.name==='bench'));
 assert.equal(context.robotPose,null);assert.match(context.source,/not visual memory/);
});
