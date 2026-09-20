'use client';
import {useRef,useState} from 'react';
export function useMicrophone(send:(message:unknown)=>void){
 const [listening,setListening]=useState(false),[level,setLevel]=useState(0);
 const media=useRef<MediaStream|null>(null),context=useRef<AudioContext|null>(null),node=useRef<AudioWorkletNode|null>(null),pending=useRef(false),playAt=useRef(0),sources=useRef<AudioBufferSourceNode[]>([]),acceptAudio=useRef(false);
 function silence(){acceptAudio.current=false;for(const source of sources.current){try{source.stop();}catch{}}sources.current=[];playAt.current=0;}
 function allowPlayback(){acceptAudio.current=true;}
 async function prepare(){
  if(pending.current||media.current)return;
  const status=await fetch('/api/capabilities').then(r=>r.json());if(!status.gradiumConfigured)throw new Error('GRADIUM_API_KEY is not configured. Add it to cortex/.env.local and restart the runtime and Pipecat. DEMO controls remain available.');
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone requires localhost or HTTPS.');
  const ctx=new AudioContext({sampleRate:16000});context.current=ctx;await ctx.resume();
  try{await ctx.audioWorklet.addModule('/audio/pcm-worklet.js');media.current=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:false,autoGainControl:false}});pending.current=true;send({type:'mic_start'});}catch(e){void ctx.close();context.current=null;throw e;}
 }
 function begin(){
  if(!media.current||!pending.current||!context.current)return;pending.current=false;
  const ctx=context.current,source=ctx.createMediaStreamSource(media.current),processor=new AudioWorkletNode(ctx,'cortex-pcm');node.current=processor;
  processor.port.onmessage=e=>{const m=e.data;if(m.type==='audio'){const bytes=new Uint8Array(m.buffer);let raw='';for(const b of bytes)raw+=String.fromCharCode(b);send({type:'audio',data:btoa(raw)});setLevel(Math.min(1,m.rms*12));}else{if(m.type==='speech_start')silence();send({type:m.type});}};
  source.connect(processor);const muted=ctx.createGain();muted.gain.value=0;processor.connect(muted);muted.connect(ctx.destination);setListening(true);
 }
 function play(audio:string,sampleRate:number){
  const ctx=context.current;if(!ctx||!acceptAudio.current)return;
  const bytes=Uint8Array.from(atob(audio),c=>c.charCodeAt(0));if(bytes.byteLength%2)return;
  const samples=new Int16Array(bytes.buffer),buffer=ctx.createBuffer(1,samples.length,sampleRate),channel=buffer.getChannelData(0);for(let i=0;i<samples.length;i++)channel[i]=samples[i]/32768;
  const source=ctx.createBufferSource();source.buffer=buffer;
  // Gradium returns clean PCM at a conservative level; add a modest output
  // gain so spoken responses remain audible over the simulator ambience.
  const output=ctx.createGain();output.gain.value=1.5;source.connect(output);output.connect(ctx.destination);
  const at=Math.max(ctx.currentTime+.02,playAt.current);source.start(at);playAt.current=at+buffer.duration;sources.current.push(source);source.onended=()=>{sources.current=sources.current.filter(s=>s!==source);};
 }
 function stop(notify=true){pending.current=false;silence();node.current?.disconnect();node.current=null;media.current?.getTracks().forEach(t=>t.stop());media.current=null;void context.current?.close();context.current=null;setListening(false);setLevel(0);if(notify)send({type:'mic_stop'});}
 return {prepare,begin,stop,play,silence,allowPlayback,listening,level};
}
