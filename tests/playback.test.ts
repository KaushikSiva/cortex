import test from 'node:test';
import assert from 'node:assert/strict';
import {interruptsPlayback,PlaybackEpoch,SpeechResponses} from '../src/integrations/gradium/playback';

test('stop discards buffered-in-transit speech before the server receives it',()=>{
 const browser=new PlaybackEpoch(),server=new SpeechResponses();
 const before=server.begin();assert.ok(browser.accepts(before.voiceEpoch));
 browser.interrupt();
 // Packet was already sent by the server before it receives the stop command.
 assert.equal(browser.accepts(before.voiceEpoch),false);
 server.observe(browser.value);assert.equal(server.match(before.requestId),null);
 const after=server.begin();assert.ok(browser.accepts(after.voiceEpoch));assert.deepEqual(server.match(after.requestId),after);
});

test('late provider audio is never relabeled as a newer reply',()=>{
 const server=new SpeechResponses();const old=server.begin();server.cancel();const next=server.begin();
 assert.equal(server.match(old.requestId),null);assert.deepEqual(server.match(next.requestId),next);
 server.cancel();assert.equal(server.match(next.requestId),null);assert.equal(server.match(undefined),null);
});

test('reordered or malformed client epochs cannot reopen interrupted speech',()=>{
 const server=new SpeechResponses();server.observe(4);const old=server.begin();server.observe(5);
 for(const epoch of [4,NaN,Infinity,-1,5.5,'6'])server.observe(epoch);
 assert.equal(server.match(old.requestId),null);assert.equal(server.begin().voiceEpoch,5);
});

test('all local stop paths and microphone barge-in invalidate playback',()=>{
 for(const command of [{type:'stop'},{type:'reset'},{type:'speech_start'},{type:'mic_start'},{type:'mic_stop'},{type:'fixture',name:'stop'},{type:'text',text:'Wait! STOP!'}])assert.ok(interruptsPlayback(command));
 for(const command of [{type:'heartbeat'},{type:'text',text:'Come here.'},{type:'fixture',name:'calm'}])assert.equal(interruptsPlayback(command),false);
});
