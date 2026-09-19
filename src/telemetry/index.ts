import type {Metric} from '../types';
export class Timing{
 marks=new Map<string,number>();
 mark(name:string){this.marks.set(name,performance.now());}
 clear(){this.marks.clear();}
 elapsed(a:string,b:string){const x=this.marks.get(a),y=this.marks.get(b);return x===undefined||y===undefined?null:Math.max(0,y-x);}
 metrics(demo:boolean):Metric[]{return [
  ['Voice → transcript','speech_start','gradium_voice_received'],['Voice → intent','speech_start','intent_ready'],['Transcript → reflex','gradium_voice_received','reflex_decision'],['Memory retrieval','memory_query_start','memory_response'],['Command → acknowledgement','robot_command_sent','robot_acknowledged'],['Stop → settled','stop_start','robot_settled'],['End to end','speech_start','robot_acknowledged']
 ].map(([name,a,b])=>({name,ms:this.elapsed(a,b),basis:demo?'Server clock · fixture input; no speech latency':'Server clock · VAD chunk receipt to provider/robot events'}));}
}
