/** Read-only, opt-in live inference check. Loads ignored local credentials.
 * Exposes inspection only: this test cannot issue robot movement commands. */
import {config} from 'dotenv';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {Conversation} from '../src/cognition/conversation';
import {MujocoBackend} from '../src/robot/backend';
import {spatialContext} from '../src/scene/spatialContext';
import {inferenceConfig} from '../src/integrations/inference';
config({path:'.env.local',quiet:true});
const provider=inferenceConfig();if(!provider)throw Error('A live inference key is required');
const robot=new MujocoBackend();const observations:unknown[]=[];
const conversation=new Conversation(()=>({simulation:true,navigation:spatialContext(null)}));
conversation.register('inspect_scene',{description:'Read current simulated robot pose and mapped landmark relationships. Never moves the robot.',schema:z.object({}).strict(),execute:async()=>{const state=await robot.getState();const observation={robot:state,navigation:spatialContext(state)};observations.push(observation);return observation;}});
const started=performance.now();
const answer=await conversation.reply('Use inspect_scene to tell me where the bench is relative to your current heading. Do not move.');
assert.ok(answer);assert.ok(observations.length,'Provider must actually call the structured inspection tool');
const report={at:new Date().toISOString(),passed:true,provider:provider.name,model:provider.model,elapsedMs:performance.now()-started,toolCalls:observations.length,answer,observations,provenance:'Actual provider conversation and structured tool call with live MuJoCo state. Read-only inspection of authored scene map, not camera perception, motion or human voice validation.'};
await writeFile('docs/live-conversation-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,provider:provider.name,toolCalls:observations.length,answer}));
