/** Shared provider selection for conversation and the bounded mission planner. */
export function inferenceConfig(){
 if(process.env.GENERAL_COMPUTE_API_KEY)return {
  name:'General Compute',apiKey:process.env.GENERAL_COMPUTE_API_KEY,
  endpoint:'https://api.generalcompute.com/v1/chat/completions',
  model:process.env.GENERAL_COMPUTE_MODEL||'gpt-oss-120b',maxTokens:2000,
 };
 if(process.env.SAMBANOVA_API_KEY)return {
  name:'SambaNova',apiKey:process.env.SAMBANOVA_API_KEY,
  endpoint:'https://api.sambanova.ai/v1/chat/completions',
  model:process.env.SAMBANOVA_MODEL||'Meta-Llama-3.3-70B-Instruct',maxTokens:600,
 };
 return null;
}
