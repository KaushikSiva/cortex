'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import URDFLoader,{type URDFRobot} from 'urdf-loader';
import {HDRLoader} from 'three/examples/jsm/loaders/HDRLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {buildWaterfall} from '../scene/waterfall';
import type {RobotState} from '../types';
export default function Scene({robot,onCanvas}:{robot:RobotState|null;onCanvas:(canvas:HTMLCanvasElement)=>void}){
 const host=useRef<HTMLDivElement>(null);const current=useRef(robot);current.current=robot;const [error,setError]=useState('');const [loaded,setLoaded]=useState(false);const [inspecting,setInspecting]=useState(false);
 useEffect(()=>{
  if(!host.current)return;
  const element=host.current;let disposed=false,frame=0;let model:URDFRobot|null=null;let joints:string[]=[];
  const scene=new THREE.Scene();scene.background=new THREE.Color('#b7cbd1');scene.fog=new THREE.Fog('#c8d5d5',40,110);
  const camera=new THREE.PerspectiveCamera(50,1,.05,150);camera.up.set(0,0,1);camera.position.set(2,-6,1.65);camera.lookAt(-.4,4,1.7);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;renderer.outputColorSpace=THREE.SRGBColorSpace;element.appendChild(renderer.domElement);onCanvas(renderer.domElement);
  const pmrem=new THREE.PMREMGenerator(renderer);let env:THREE.WebGLRenderTarget|undefined;let hdr:THREE.DataTexture|undefined;
  new HDRLoader().load('/assets/daylight.hdr',texture=>{if(disposed){texture.dispose();return;}hdr=texture;texture.mapping=THREE.EquirectangularReflectionMapping;env=pmrem.fromEquirectangular(texture);scene.environment=env.texture;scene.background=texture;scene.backgroundRotation.x=Math.PI/2;scene.environmentRotation.x=Math.PI/2;scene.backgroundBlurriness=.05;scene.environmentIntensity=.7;});
  scene.add(new THREE.HemisphereLight('#e0ebf1','#808581',1.1));
  const sun=new THREE.DirectionalLight('#fff9eb',2.1);sun.position.set(-8,-7,14);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-15,right:15,top:14,bottom:-14,near:.2,far:45});sun.shadow.normalBias=.008;sun.shadow.bias=-.0001;sun.shadow.radius=3;scene.add(sun);
  const world=buildWaterfall(scene);const floor=world.ground;
  const mat=(c:string,roughness=.9)=>new THREE.MeshStandardMaterial({color:c,roughness});
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(-.4,4,1.7);controls.enabled=false;controls.enableDamping=true;controls.minDistance=3;controls.maxDistance=25;controls.maxPolarAngle=Math.PI*.49;controls.update();
  let inspection=false;const inspect=(event:Event)=>{const detail=(event as CustomEvent).detail;inspection=typeof detail==='boolean'?detail:!inspection;controls.enabled=inspection;setInspecting(inspection);if(!inspection){camera.position.set(2,-6,1.65);controls.target.set(-.4,4,1.7);camera.lookAt(controls.target);controls.update();}};window.addEventListener('cortex-inspect',inspect);
  // The backpack is deliberately placed and labeled by the operator in the demo world.
  const bag=new THREE.Group();bag.position.set(2.14,1.69,.23);bag.rotation.z=.18;
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.17,.22,6,12),mat('#b66438',.96));body.rotation.x=Math.PI/2;body.scale.set(1,.95,.72);body.castShadow=true;bag.add(body);
  const pocket=new THREE.Mesh(new THREE.BoxGeometry(.23,.09,.22),mat('#a0502b'));pocket.position.set(0,-.12,-.015);pocket.castShadow=true;bag.add(pocket);
  const loop=new THREE.Mesh(new THREE.TorusGeometry(.075,.012,5,12,Math.PI),mat('#493523'));loop.rotation.x=Math.PI/2;loop.position.z=.25;bag.add(loop);scene.add(bag);
  let disposeSplat:(()=>void)|undefined;
  if(process.env.NEXT_PUBLIC_SPLAT_MANIFEST){const prototypes=[world.group];import('../scene/reconstruction').then(({loadReconstruction})=>loadReconstruction(scene,renderer,process.env.NEXT_PUBLIC_SPLAT_MANIFEST!)).then(result=>{if(disposed){result.dispose();return;}disposeSplat=result.dispose;prototypes.forEach(o=>{o.visible=false;});(floor as THREE.Mesh).material=new THREE.ShadowMaterial({opacity:.28});scene.background=new THREE.Color('#aabcc2');}).catch(e=>setError('Reconstruction failed: '+String(e)));}
  const manager=new THREE.LoadingManager();manager.onError=url=>setError('Robot asset failed: '+url);const loader=new URDFLoader(manager);loader.parseCollision=false;const meshPromises:Promise<void>[]=[];const defaultLoad=loader.loadMeshCb;loader.loadMeshCb=(url,manager,material,done)=>{meshPromises.push(new Promise<void>((resolve,reject)=>{defaultLoad(url,manager,material,(obj,err)=>{done(obj,err);if(err)reject(err);else resolve();});}));};
  Promise.all([loader.loadAsync('/assets/g1/g1_12dof.urdf'),fetch('/assets/g1/joints.json').then(r=>r.json())]).then(async([r,names])=>{
   await Promise.all(meshPromises);if(disposed)return;model=r;joints=names;r.traverse(o=>{if((o as THREE.Mesh).isMesh){const mesh=o as THREE.Mesh;mesh.castShadow=mesh.receiveShadow=true;const name=[o.name,o.parent?.name,o.parent?.parent?.name].join(' ');const dark=/head|hip|ankle|elbow|wrist|shoulder/i.test(name);mesh.material=new THREE.MeshStandardMaterial({color:dark?'#252d2e':'#8c9897',roughness:dark?.56:.35,metalness:dark?.28:.65});}});scene.add(r);const debug:string[]=[];r.traverse(o=>{if((o as THREE.Mesh).isMesh)debug.push(o.parent?.parent?.name+':'+((o as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString());});renderer.domElement.dataset.materials=JSON.stringify(debug);setLoaded(true);
  }).catch(e=>setError(String(e)));
  const size=()=>{const w=element.clientWidth,h=element.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const resize=new ResizeObserver(size);resize.observe(element);size();
  let q:number[]=[];
  const animate=()=>{
   frame=requestAnimationFrame(animate);const target=current.current?.qpos;
   if(model&&target){if(!q.length)q=[...target];else q=q.map((v,i)=>THREE.MathUtils.lerp(v,target[i],.42));model.position.set(q[0],q[1],q[2]);model.quaternion.set(q[4],q[5],q[6],q[3]);joints.forEach((name,i)=>model!.setJointValue(name,q[i+7]));}
   world.update(performance.now()/1000);if(inspection)controls.update();renderer.domElement.dataset.camera=JSON.stringify(camera.position.toArray());renderer.render(scene,camera);
  };animate();
  return()=>{disposed=true;disposeSplat?.();cancelAnimationFrame(frame);resize.disconnect();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});world.dispose();controls.dispose();window.removeEventListener('cortex-inspect',inspect);env?.dispose();hdr?.dispose();pmrem.dispose();renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div className="scene-canvas" ref={host}>{inspecting&&<div className="scene-inspection">3D inspection · drag to orbit · scroll to move closer</div>}{!loaded&&!error&&<div className="scene-loading"><span/>Loading Unitree G1…</div>}{error&&<div className="scene-loading">{error}</div>}</div>;
}
