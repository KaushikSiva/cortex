import WebSocket from 'ws';
export class GradiumBridge{
 socket:WebSocket|null=null;
 constructor(private onEvent:(raw:unknown)=>void,private onStatus:(status:string)=>void){}
 connect(){
  if(!process.env.GRADIUM_API_KEY)throw new Error('GRADIUM_API_KEY is not configured. DEMO controls remain available.');
  if(this.socket)return;
  const base=new URL(process.env.PIPECAT_API_URL??'http://127.0.0.1:8003');base.protocol=base.protocol==='https:'?'wss:':'ws:';base.pathname='/voice';
  this.socket=new WebSocket(base,{handshakeTimeout:10000});
  this.socket.on('message',data=>{try{const event=JSON.parse(data.toString());if(event.type==='voice_ready')this.onStatus('LIVE');else this.onEvent(event);}catch{this.onStatus('Invalid Pipecat event');}});
  this.socket.on('error',()=>this.onStatus('Pipecat voice connection failed. Check the sidecar and Gradium credentials.'));
  this.socket.on('close',()=>{this.socket=null;this.onStatus('OFFLINE');});
 }
 send(event:unknown){if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(event));}
 audio(data:string){this.send({type:'audio',data});}
 close(){this.socket?.close();this.socket=null;}
}
