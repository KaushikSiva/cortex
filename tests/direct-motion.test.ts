import test from 'node:test';
import assert from 'node:assert/strict';
import {directMotion} from '../src/cognition/directMotion';
test('spoken quantities and observed STT homophone resolve only inside explicit bounded commands',()=>{
 for(const transcript of ['Move forward two meters.','move forward to meters.'])assert.deepEqual(directMotion(transcript),{name:'walk',arguments:{direction:'front',meters:2}});
 assert.deepEqual(directMotion('Turn right ninety degrees.'),{name:'turn',arguments:{angleDegrees:-90}});
 assert.deepEqual(directMotion('Move back one meter.'),{name:'walk',arguments:{direction:'back',meters:1}});
 assert.deepEqual(directMotion('Walk left half a meter.'),{name:'walk',arguments:{direction:'left',meters:.5}});
 for(const text of ['Where is the bench?','What does move forward two meters mean?','Do not move forward two meters.'])assert.equal(directMotion(text),null);
});
