import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inferenceConfig} from '../src/integrations/inference';
test('General Compute takes precedence and retains optional SambaNova fallback',()=>{
 const keys=['GENERAL_COMPUTE_API_KEY','GENERAL_COMPUTE_MODEL','SAMBANOVA_API_KEY','SAMBANOVA_MODEL'];
 const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 try{
  for(const key of keys)delete process.env[key];assert.equal(inferenceConfig(),null);
  process.env.SAMBANOVA_API_KEY='test-samba';assert.equal(inferenceConfig()?.name,'SambaNova');
  process.env.GENERAL_COMPUTE_API_KEY='test-gc';assert.equal(inferenceConfig()?.name,'General Compute');
  assert.equal(inferenceConfig()?.endpoint,'https://api.generalcompute.com/v1/chat/completions');
  assert.equal(inferenceConfig()?.model,'gpt-oss-120b');
  process.env.GENERAL_COMPUTE_MODEL='custom-model';assert.equal(inferenceConfig()?.model,'custom-model');
 }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
