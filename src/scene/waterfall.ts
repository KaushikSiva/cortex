import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {Water} from 'three/examples/jsm/objects/Water.js';

/** Full geometry, not a backplate: every surface responds to a moving camera. */
export function buildWaterfall(scene:THREE.Scene){
 const group=new THREE.Group();group.name='Yerba Buena · MLK memorial study';scene.add(group);
 const textures:THREE.Texture[]=[];const loader=new THREE.TextureLoader();
 function texture(path:string,repeat:number,color=false){const t=loader.load(path);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;if(color)t.colorSpace=THREE.SRGBColorSpace;textures.push(t);return t;}
 const graniteColor=texture('/assets/waterfall-original.jpg',1,true),graniteNormal=texture('/assets/slab-normal.jpg',1),graniteRough=texture('/assets/slab-rough.jpg',1);
 for(const t of [graniteColor,graniteNormal,graniteRough]){t.repeat.set(.29,.46);t.offset.set(.02,.02);}
 graniteColor.repeat.set(.026,.085);graniteColor.offset.set(.518,.49);
 const stone=new THREE.MeshStandardMaterial({map:graniteColor,normalMap:graniteNormal,normalScale:new THREE.Vector2(.16,.16),roughnessMap:graniteRough,roughness:.83,color:'#eeeeea'});
 const wetStone=stone.clone();wetStone.color.set('#676f6a');wetStone.roughness=.3;
 const concrete=new THREE.MeshStandardMaterial({color:'#a5a7a2',roughness:.82,map:graniteColor,normalMap:graniteNormal,normalScale:new THREE.Vector2(.18,.18)});
 for(const material of [stone,wetStone,concrete])material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb = vec3(dot(diffuseColor.rgb, vec3(0.2126,0.7152,0.0722))) * 1.05;');};
 function box(x:number,y:number,z:number,w:number,d:number,h:number,material:THREE.Material=stone,round=.025){const g=new RoundedBoxGeometry(w,d,h,2,round);const mesh=new THREE.Mesh(g,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;}
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(60,50,40,40),new THREE.MeshStandardMaterial({map:texture('/assets/pavement-color.jpg',25,true),normalMap:texture('/assets/pavement-normal.jpg',25),roughnessMap:texture('/assets/pavement-rough.jpg',25),normalScale:new THREE.Vector2(.38,.38),roughness:.85,color:'#bfc3c5'}));ground.position.z=-.006;ground.receiveShadow=true;group.add(ground);
 // Basin front is y=4.65; known waypoints remain in the dry pedestrian apron.
 box(0,5.65,-.10,20,2.2,.25,wetStone);box(0,4.55,.19,20,.24,.38,concrete);box(-10,5.6,.19,.26,2.2,.38,concrete);box(10,5.6,.19,.26,2.2,.38,concrete);
 box(0,6.9,2.35,22,.8,4.7,wetStone);
 const waterUniforms={time:{value:0},tint:{value:new THREE.Color('#d8e6e8')}};
 const falling=new THREE.ShaderMaterial({uniforms:waterUniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,vertexShader:`varying vec2 vUv; varying vec3 vWorld; void main(){vUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;varying vec3 vWorld;uniform float time;uniform vec3 tint;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 void main(){float t=time*2.;float ribbon=noise(vec2(vUv.x*50.,vUv.y*12.+t));float fine=noise(vec2(vUv.x*180.,vUv.y*60.+t*5.));float stream=pow(ribbon,1.3)*.8+fine*.25;float edges=smoothstep(0.,.06,vUv.x)*smoothstep(0.,.06,1.-vUv.x);float foam=pow(1.-vUv.y,9.)*.28;float opacity=(stream+foam)*edges;gl_FragColor=vec4(tint*(.8+fine*.35),opacity*.90);}`});
 for(let i=0;i<13;i++){
  const x=-9.3+i*1.52;const h=4.55+Math.sin(i*.47)*.30+i*.045;const lean=Math.sin(i*1.2)*.06;
  for(let row=0;row<3;row++){
   const block=box(x,6.25+(i%2)*.12,(row+.5)*(h/3),1.0+(i%3)*.07,.9+(i%3)*.15,h/3-.014,stone,.035);block.rotation.y=lean;
   // Textures vary per block while preserving full geometric depth.
   block.rotation.z=(i%2?1:-1)*.006;
  }
  const sheet=new THREE.Mesh(new THREE.PlaneGeometry(.85,h-.05,8,24),falling);sheet.rotation.x=Math.PI/2;sheet.position.set(x+.72,5.95,h/2);group.add(sheet);
  box(x+.7,6.4,h+.015,.58,1,.06,wetStone);
  // Broken granite at the base of the falls, submerged in the basin.
  const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(.38+(i%3)*.12,0),stone);rock.scale.set(1.6,1,.32);rock.position.set(x+(i%2)*.4,5.6,.11);rock.rotation.z=i*1.8;rock.castShadow=rock.receiveShadow=true;group.add(rock);
 }
 const normal=texture('/assets/water-normal.jpg',1);
 const water=new Water(new THREE.PlaneGeometry(19.65,1.75),{textureWidth:1024,textureHeight:512,waterNormals:normal,sunDirection:new THREE.Vector3(-.3,-.45,.85),sunColor:0xe8edf3,waterColor:0x354b40,distortionScale:.3,fog:true});water.position.set(0,5.58,.065);water.material.fragmentShader=water.material.fragmentShader.replaceAll('worldPosition.xz','worldPosition.xy');group.add(water);
 // Fine spray exists in space, rather than being painted on the waterfall.
 const positions=new Float32Array(800*3);let seed=23;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<800;i++){positions[i*3]=(rand()-.5)*19;positions[i*3+1]=5.4+rand()*.75;positions[i*3+2]=rand()*.28+.13;}
 const sprayGeometry=new THREE.BufferGeometry();sprayGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const spray=new THREE.Points(sprayGeometry,new THREE.PointsMaterial({color:'#dbe9e9',size:.012,transparent:true,opacity:.22,depthWrite:false}));group.add(spray);
 // Side galleries and terrace rails reproduce the memorial's spatial enclosure.
 for(const side of [-1,1]){
  box(side*12,6.8,1.9,3.8,3.5,3.8,concrete);box(side*12,4.9,3.7,4.3,.3,.42,stone);
  const metal=new THREE.MeshStandardMaterial({color:'#b1b5b1',roughness:.38,metalness:.75});
  for(let i=0;i<20;i++)box(side*10.2+side*i*.2,4.82,4.4,.025,.025,1.05,metal,.008);
  box(side*12.1,4.82,4.93,4,.045,.045,metal,.012);
 }
 // Modest props correspond to the collision objects and memory waypoint.
 box(2.8,2.6,.35,2,1.4,.7,stone);box(2.8,2.6,.72,2.10,1.50,.08,concrete);box(2.8,2.6,.755,1.8,1.2,.04,new THREE.MeshStandardMaterial({color:'#282b20',roughness:1}));
 const leaves=new THREE.MeshStandardMaterial({color:'#465540',roughness:.92,side:THREE.DoubleSide});
 for(let i=0;i<90;i++){const shape=new THREE.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(.08,.12,0,.35+rand()*.2);shape.quadraticCurveTo(-.08,.12,0,0);const plant=new THREE.Mesh(new THREE.ShapeGeometry(shape,6),leaves);plant.rotation.x=Math.PI/2;plant.rotation.y=(rand()-.5)*1.2;plant.rotation.z=rand()*Math.PI*2;plant.position.set(2.8+(rand()-.5)*1.75,2.6+(rand()-.5)*1.15,.78);plant.castShadow=true;group.add(plant);}
 box(-1,3.5,.44,2,.6,.14,concrete);for(const x of [-1.7,-.3])box(x,3.5,.2,.16,.48,.4,stone);
 return {group,ground,update(t:number){waterUniforms.time.value=t;water.material.uniforms.time.value=t*.38;spray.position.z=Math.sin(t*3)*.025;},dispose(){textures.forEach(t=>t.dispose());water.material.uniforms.mirrorSampler.value?.dispose();}};
}
