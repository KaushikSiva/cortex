'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowUp,ArrowDown,ArrowLeft,ArrowRight,RotateCcw,RotateCw} from 'lucide-react';
import type {Direction} from '../cognition/tools/motion';
type Props={send:(message:unknown)=>void;connected:boolean;latched:boolean};
const keys:Record<string,Direction>={KeyW:'front',ArrowUp:'front',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyS:'back',ArrowDown:'back'};
export function KeyboardControls({send,connected,latched}:Props){
 const held=useRef<{session:string;key:string}|null>(null);const [active,setActive]=useState<Direction|null>(null);const [target,setTarget]=useState('BENCH');
 const release=useCallback(()=>{const key=held.current;if(!key)return;held.current=null;setActive(null);send({type:'manual_end',session:key.session});},[send]);
 const press=useCallback((direction:Direction,key:string)=>{if(!connected||latched)return;if(held.current?.key===key)return;release();const session=crypto.randomUUID();held.current={session,key};setActive(direction);send({type:'manual_start',direction,session});},[send,connected,latched,release]);
 const turn=useCallback((angleDegrees:number)=>{release();send({type:'tool',name:'turn',arguments:{angleDegrees}});},[release,send]);
 useEffect(()=>{
  const editable=(target:EventTarget|null)=>target instanceof HTMLElement&&!!target.closest('input,textarea,select,[contenteditable="true"]');
  const down=(event:KeyboardEvent)=>{if(editable(event.target)||event.repeat)return;const direction=keys[event.code];if(direction){event.preventDefault();press(direction,event.code);}else if(event.code==='KeyQ'||event.code==='KeyE'){event.preventDefault();turn(event.code==='KeyQ'?90:-90);}else if(event.code==='Space')release();};
  const up=(event:KeyboardEvent)=>{if(held.current?.key===event.code){event.preventDefault();release();}};
  const hidden=()=>{if(document.hidden)release();};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',release);document.addEventListener('visibilitychange',hidden);
  const timer=setInterval(()=>{if(held.current)send({type:'manual_renew',session:held.current.session});},200);
  return()=>{clearInterval(timer);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',release);document.removeEventListener('visibilitychange',hidden);release();};
 },[press,release,turn,send]);
 useEffect(()=>{if(!connected||latched)release();},[connected,latched,release]);
 const button=(direction:Direction,label:string,Icon:typeof ArrowUp)=><button key={direction} aria-label={`Walk ${direction}`} className={active===direction?'held':''} disabled={!connected||latched} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);press(direction,'pointer-'+direction);}} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><Icon size={15}/><kbd>{label}</kbd></button>;
 return <section className="motion-console" aria-label="Robot movement controls">
  <div><span className="eyebrow">HOLD TO WALK</span><div className="direction-pad">{button('front','W / ↑',ArrowUp)}{button('left','A / ←',ArrowLeft)}{button('back','S / ↓',ArrowDown)}{button('right','D / →',ArrowRight)}</div><small>Faces the direction first. Release to pause.</small></div>
  <div className="turn-controls"><span className="eyebrow">TURN IN PLACE</span><div><button onClick={()=>turn(90)} disabled={!connected||latched} aria-label="Turn left 90 degrees"><RotateCcw size={14}/>Left <kbd>Q</kbd></button><button onClick={()=>turn(-90)} disabled={!connected||latched} aria-label="Turn right 90 degrees"><RotateCw size={14}/>Right <kbd>E</kbd></button></div><small>Robot-relative directions · Space stops.</small></div>
  <div className="target-controls"><span className="eyebrow">WALK TO TARGET</span><div><select aria-label="Navigation target" value={target} onChange={e=>setTarget(e.target.value)}>{['HOME','PERSON','PLANTER','BENCH','DOOR'].map(p=><option key={p}>{p}</option>)}</select><button disabled={!connected||latched} onClick={()=>{release();send({type:'tool',name:'walk_to',arguments:{target}});}}>Go <ArrowRight size={14}/></button></div><small>{latched?'Stop latched — use Resume first.':'SambaNova plan · Jev / local reflex check'}</small></div>
 </section>;
}
