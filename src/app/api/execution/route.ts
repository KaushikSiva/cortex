import {timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {LocalExecutionAdapter} from '../../../integrations/edgeone';
export const runtime='nodejs';
export async function POST(req:Request){
 const expected=process.env.EDGEONE_EXECUTION_TOKEN;
 if(!expected)return Response.json({error:'Execution endpoint disabled until token configured'},{status:503});
 const a=Buffer.from(req.headers.get('Authorization')??''),b=Buffer.from(`Bearer ${expected}`);
 if(a.length!==b.length||!timingSafeEqual(a,b))return Response.json({error:'Unauthorized'},{status:401});
 try{const {command}=z.object({command:z.enum(['healthcheck','read_controller_state'])}).strict().parse(await req.json());return Response.json(await new LocalExecutionAdapter().executeCommand(command));}catch{return Response.json({error:'Command rejected or controller unavailable'},{status:400});}
}
