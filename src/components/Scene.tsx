'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import URDFLoader,{type URDFRobot} from 'urdf-loader';
import {HDRLoader} from 'three/examples/jsm/loaders/HDRLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {prepareDaylight} from '../scene/rendering/daylight';
import {createSceneRenderer} from '../scene/rendering/composer';
import {buildPaintedLadies} from '../scene/paintedLadies';
import type {RobotState} from '../types';
export default function Scene({robot,onCanvas}:{robot:RobotState|null;onCanvas:(canvas:HTMLCanvasElement)=>void}){
 const host=useRef<HTMLDivElement>(null);const current=useRef(robot);current.current=robot;const [error,setError]=useState('');const [loaded,setLoaded]=useState(false);const [inspecting,setInspecting]=useState(false);
 useEffect(()=>{
  if(!host.current)return;
  const element=host.current;let disposed=false,frame=0;let model:URDFRobot|null=null;let joints:string[]=[];
  const scene=new THREE.Scene();scene.background=new THREE.Color('#b7cbd1');scene.fog=new THREE.Fog('#c8d5d5',40,110);
  const camera=new THREE.PerspectiveCamera(60,1,.05,150);camera.up.set(0,0,1);camera.position.set(0,-6,1.65);camera.lookAt(0,25,3.0);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;renderer.outputColorSpace=THREE.SRGBColorSpace;element.appendChild(renderer.domElement);onCanvas(renderer.domElement);
  let env:THREE.WebGLRenderTarget|undefined;let hdr:THREE.DataTexture|undefined;
  const ambient=new THREE.HemisphereLight('#e0ebf1','#808581',.35);scene.add(ambient);
  const sun=new THREE.DirectionalLight('#fff9eb',2.1);sun.position.set(-8,-7,14);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:.2,far:90});sun.shadow.normalBias=.006;sun.shadow.bias=-.00008;sun.shadow.radius=2;scene.add(sun,sun.target);
  new HDRLoader().load('/assets/daylight.hdr',texture=>{
   if(disposed){texture.dispose();return;}hdr=texture;
   try{const daylight=prepareDaylight(texture,renderer);env=daylight.target;scene.environment=daylight.environment;scene.environmentRotation.set(Math.PI/2,daylight.rotation,0);scene.environmentIntensity=1;ambient.intensity=0;
    sun.position.copy(daylight.direction).applyAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2).multiplyScalar(35);sun.color.copy(daylight.color);sun.intensity=daylight.intensity;
    renderer.domElement.dataset.lighting=JSON.stringify({method:'solar-separated HDR',intensity:sun.intensity,direction:sun.position.toArray()});
   }catch(e){setError('Daylight preparation failed: '+String(e));}
  });
  const world=buildPaintedLadies(scene);const floor=world.ground;const post=createSceneRenderer(scene,renderer,camera);renderer.domElement.dataset.fov="60";renderer.domElement.dataset.renderer="Solar-separated HDR · 4096 shadow map · GTAO · SMAA";
  const mat=(c:string,roughness=.9)=>new THREE.MeshStandardMaterial({color:c,roughness});
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,25,3.0);controls.enabled=false;controls.enableDamping=true;controls.minDistance=3;controls.maxDistance=45;controls.maxPolarAngle=Math.PI*.52;controls.minAzimuthAngle=-Math.PI/3;controls.maxAzimuthAngle=Math.PI/3;controls.update();
  let inspection=false;const inspect=(event:Event)=>{const detail=(event as CustomEvent).detail;inspection=typeof detail==='boolean'?detail:!inspection;controls.enabled=inspection;setInspecting(inspection);if(!inspection){camera.position.set(0,-6,1.65);controls.target.set(0,25,3.0);camera.lookAt(controls.target);controls.update();}};window.addEventListener('cortex-inspect',inspect);
  const angleView=()=>{inspection=true;controls.enabled=true;setInspecting(true);controls.target.set(0,1,1.2);camera.position.set(Math.sin(Math.PI/3)*10,1-Math.cos(Math.PI/3)*10,1.65);camera.lookAt(controls.target);controls.update();};window.addEventListener('cortex-view-angle',angleView);
  // The backpack is deliberately placed and labeled by the operator in the demo world.
  const bag=new THREE.Group();bag.position.set(2.14,1.69,.23);bag.rotation.z=.18;
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.17,.22,6,12),mat('#b66438',.96));body.rotation.x=Math.PI/2;body.scale.set(1,.95,.72);body.castShadow=true;bag.add(body);
  const pocket=new THREE.Mesh(new THREE.BoxGeometry(.23,.09,.22),mat('#a0502b'));pocket.position.set(0,-.12,-.015);pocket.castShadow=true;bag.add(pocket);
  const loop=new THREE.Mesh(new THREE.TorusGeometry(.075,.012,5,12,Math.PI),mat('#493523'));loop.rotation.x=Math.PI/2;loop.position.z=.25;bag.add(loop);scene.add(bag);
  let disposeSplat:(()=>void)|undefined;
  if(process.env.NEXT_PUBLIC_SPLAT_MANIFEST){const prototypes=[world.group];import('../scene/reconstruction').then(({loadReconstruction})=>loadReconstruction(scene,renderer,process.env.NEXT_PUBLIC_SPLAT_MANIFEST!)).then(result=>{if(disposed){result.dispose();return;}disposeSplat=result.dispose;prototypes.forEach(o=>{o.visible=false;});scene.attach(floor);floor.material.dispose();(floor as THREE.Mesh).material=new THREE.ShadowMaterial({opacity:.28});scene.background=new THREE.Color('#aabcc2');}).catch(e=>setError('Reconstruction failed: '+String(e)));}
  const manager=new THREE.LoadingManager();manager.onError=url=>setError('Robot asset failed: '+url);const loader=new URDFLoader(manager);loader.parseCollision=false;const meshPromises:Promise<void>[]=[];const defaultLoad=loader.loadMeshCb;loader.loadMeshCb=(url,manager,material,done)=>{meshPromises.push(new Promise<void>((resolve,reject)=>{defaultLoad(url,manager,material,(obj,err)=>{done(obj,err);if(err)reject(err);else resolve();});}));};
  Promise.all([loader.loadAsync('/assets/g1/g1_12dof.urdf'),fetch('/assets/g1/joints.json').then(r=>r.json())]).then(async([r,names])=>{
   await Promise.all([...meshPromises,world.ready]);if(disposed)return;renderer.domElement.dataset.scene="Painted Ladies photogrammetry";renderer.domElement.dataset.scanVertices=String(world.scanVertices);model=r;joints=names;r.traverse(o=>{if((o as THREE.Mesh).isMesh){const mesh=o as THREE.Mesh;mesh.castShadow=mesh.receiveShadow=true;const name=[o.name,o.parent?.name,o.parent?.parent?.name].join(' ');const dark=/head|hip|ankle|elbow|wrist|shoulder/i.test(name);mesh.material=new THREE.MeshStandardMaterial({color:dark?'#252d2e':'#b8beba',roughness:dark?.56:.43,metalness:dark?.18:.25});}});scene.add(r);const debug:string[]=[];r.traverse(o=>{if((o as THREE.Mesh).isMesh)debug.push(o.parent?.parent?.name+':'+((o as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString());});renderer.domElement.dataset.materials=JSON.stringify(debug);setLoaded(true);
  }).catch(e=>setError(String(e)));
  const size=()=>{const w=element.clientWidth,h=element.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();post.resize(w,h);};const resize=new ResizeObserver(size);resize.observe(element);size();
  let q:number[]=[];
  const animate=()=>{
   frame=requestAnimationFrame(animate);const target=current.current?.qpos;
   if(model&&target){if(!q.length)q=[...target];else q=q.map((v,i)=>THREE.MathUtils.lerp(v,target[i],.42));model.position.set(q[0],q[1],q[2]);model.quaternion.set(q[4],q[5],q[6],q[3]);joints.forEach((name,i)=>model!.setJointValue(name,q[i+7]));}
   world.update(performance.now()/1000);if(inspection)controls.update();renderer.domElement.dataset.camera=JSON.stringify(camera.position.toArray());post.render();
  };animate();
  return()=>{disposed=true;disposeSplat?.();cancelAnimationFrame(frame);resize.disconnect();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});world.dispose();controls.dispose();window.removeEventListener('cortex-inspect',inspect);window.removeEventListener('cortex-view-angle',angleView);post.dispose();env?.dispose();hdr?.dispose();renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div className="scene-canvas" ref={host}>{inspecting&&<div className="scene-inspection">3D inspection · 60° lens · drag to orbit · scroll to move closer</div>}{!loaded&&!error&&<div className="scene-loading"><span/>Loading G1 and Painted Ladies scan…</div>}{error&&<div className="scene-loading">{error}</div>}</div>;
}
