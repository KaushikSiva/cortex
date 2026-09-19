import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {buildVictorians} from './victorians';
import {centralAvenueLeafMaterial} from './rendering/leafMaterial';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** CC BY 4.0 jtressle scan + authored park foreground. Local scale is approximate. */
export function buildPaintedLadies(scene:THREE.Scene){
 const group=new THREE.Group();group.name='Painted Ladies · Alamo Square';scene.add(group);
 const architecture=buildVictorians();group.add(architecture);let captured:THREE.Group|undefined;
 const reference=(event:Event)=>{const show=!!(event as CustomEvent).detail;architecture.visible=!show;if(captured)captured.visible=show;};window.addEventListener('cortex-scene-reference',reference);
 const textures:THREE.Texture[]=[];const loader=new THREE.TextureLoader();let disposed=false;let scanVertices=0;
 const texture=(file:string,x:number,y:number,color=false)=>{const t=loader.load('/assets/'+file);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(x,y);t.anisotropy=16;if(color)t.colorSpace=THREE.SRGBColorSpace;textures.push(t);return t;};
 const sky:THREE.Mesh<THREE.SphereGeometry,THREE.Material>=new THREE.Mesh(new THREE.SphereGeometry(135,24,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{horizon:{value:new THREE.Color('#c5d9e4')},zenith:{value:new THREE.Color('#4c8dce')}},vertexShader:`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 direction;uniform vec3 horizon;uniform vec3 zenith;void main(){float h=max(normalize(direction).z,0.);gl_FragColor=vec4(mix(horizon,zenith,pow(h,.35)),1.);
#include <colorspace_fragment>
}`}));sky.renderOrder=-1;sky.userData.excludeFromAO=true;group.add(sky);
 const concrete=new THREE.MeshStandardMaterial({color:'#c4c5bd',map:texture('concrete-color.jpg',1,1,true),normalMap:texture('concrete-normal.jpg',1,1),normalScale:new THREE.Vector2(.10,.10),roughnessMap:texture('concrete-rough.jpg',1,1),roughness:.92});
 const iron=new THREE.MeshStandardMaterial({color:'#30372f',roughness:.65,metalness:.65});
 const wood=new THREE.MeshStandardMaterial({color:'#7f7258',roughness:.85});
 const box=(x:number,y:number,z:number,w:number,d:number,h:number,m:THREE.Material=concrete,r=.015)=>{const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,d,h,2,r),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;};
 const paving=new THREE.MeshStandardMaterial({map:texture('concrete-color.jpg',8,3.5,true),normalMap:texture('concrete-normal.jpg',8,3.5),roughnessMap:texture('concrete-rough.jpg',8,3.5),normalScale:new THREE.Vector2(.22,.22),roughness:.95,color:'#d8d6ca'});
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(24,10.6),paving);ground.position.set(0,-.65,-.006);ground.receiveShadow=true;group.add(ground);
 const grass=new THREE.MeshStandardMaterial({map:texture('grass-color.jpg',22,22,true),normalMap:texture('grass-normal.jpg',22,22),roughnessMap:texture('grass-rough.jpg',22,22),normalScale:new THREE.Vector2(.38,.38),roughness:1,color:'#abbc88'});
 const lawnGeometry=new THREE.PlaneGeometry(100,100,100,100);const points=lawnGeometry.getAttribute('position');
 for(let i=0;i<points.count;i++){const y=points.getY(i);points.setZ(i,y>4.6?-Math.min((y-4.6)*.17,1.6)-.035:-.035);}
 lawnGeometry.computeVertexNormals();const lawn=new THREE.Mesh(lawnGeometry,grass);lawn.receiveShadow=true;group.add(lawn);
 // The walking apron ends at a real colliding curb. No mission crosses Steiner Street.
 box(0,4.55,.09,24,.24,.18);box(0,-6,.09,24,.24,.18);
 const road=new THREE.Mesh(new THREE.PlaneGeometry(100,9),new THREE.MeshStandardMaterial({map:texture('asphalt-color.jpg',30,3,true),normalMap:texture('asphalt-normal.jpg',30,3),roughnessMap:texture('asphalt-rough.jpg',30,3),normalScale:new THREE.Vector2(.2,.2),color:'#999c96',roughness:1}));road.position.set(0,18.2,-1.61);road.receiveShadow=true;group.add(road);
 box(0,13.6,-1.55,70,.25,.18);box(0,22.8,-1.55,70,.25,.18);
 // Demo props are explicitly placed, not asserted to be surveyed park furniture.
 box(2.8,2.6,.35,2,1.4,.7);box(2.8,2.6,.72,2.1,1.5,.08);box(2.8,2.6,.765,1.84,1.24,.02,new THREE.MeshStandardMaterial({color:'#373627',roughness:1}));
 let seed=23;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 for(let i=0;i<360;i++){
  const cx=2.8+(rand()-.5)*1.7,cy=2.6+(rand()-.5)*1.05,a=rand()*Math.PI*2,length=.28+rand()*.58,lean=.15+rand()*.4,width=.012+rand()*.018;
  const c=new THREE.Color().setHSL(.23+rand()*.035,.2+rand()*.2,.16+rand()*.1),base=positions.length/3;
  for(let j=0;j<=10;j++){const t=j/10,spread=lean*t*t,w=width*Math.sin(Math.PI*t)*.5;for(const side of [-1,1]){positions.push(cx+Math.cos(a)*spread-Math.sin(a)*w*side,cy+Math.sin(a)*spread+Math.cos(a)*w*side,.775+length*t-.16*t*t);colors.push(c.r,c.g,c.b);}if(j<10){const n=base+j*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}
 }
 const leavesGeometry=new THREE.BufferGeometry();leavesGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));leavesGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));leavesGeometry.setIndex(indices);leavesGeometry.computeVertexNormals();const leaves=new THREE.Mesh(leavesGeometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,side:THREE.DoubleSide}));leaves.castShadow=leaves.receiveShadow=true;group.add(leaves);
 for(let i=0;i<5;i++)box(-1,3.24+i*.12,.46,2,.095,.075,wood);
 for(const x of [-1.75,-.25]){box(x,3.5,.22,.07,.45,.44,iron);box(x,3.79,.72,.055,.055,.62,iron);}
 for(let i=0;i<3;i++)box(-1,3.79,.72+i*.115,2,.07,.09,wood);
 // Do not relight baked capture colors as PBR albedo: the scan includes real illumination.
 const scanReady=new GLTFLoader().loadAsync('/assets/painted-ladies/scene.glb').then(gltf=>{
  const scan=gltf.scene;scan.rotation.x=Math.PI/2;scan.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(scan),center=bounds.getCenter(new THREE.Vector3());const scale=66;
  scan.scale.setScalar(scale);scan.position.set(-center.x*scale,24-bounds.min.y*scale,-1.55-bounds.min.z*scale);scan.name='jtressle · Painted Ladies photogrammetry · CC BY 4.0';
  scan.traverse(o=>{if(!(o instanceof THREE.Mesh))return;scanVertices+=o.geometry.getAttribute('position').count;o.userData.excludeFromAO=true;o.castShadow=false;o.receiveShadow=false;const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials){const m=material as THREE.MeshBasicMaterial;if(m.map){m.map.anisotropy=16;textures.push(m.map);}m.side=THREE.DoubleSide;m.toneMapped=false;
    // Discard blue captured-sky fragments only above the roof line. Geometry/atlas stay intact.
    m.onBeforeCompile=shader=>{shader.vertexShader='varying float captureHeight;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n captureHeight=(modelMatrix*vec4(position,1.)).z;');shader.fragmentShader='varying float captureHeight;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n bool skyIsland=(vMapUv.x>.555 && vMapUv.y>.39 && vMapUv.y<.60)||(vMapUv.y>.81 && vMapUv.x<.56)||(vMapUv.x>.30 && vMapUv.x<.46 && vMapUv.y>.07 && vMapUv.y<.20); if(skyIsland && captureHeight>8. && diffuseColor.b-diffuseColor.r>.18 && diffuseColor.b>.40) discard;');};
  }});
  if(disposed){scan.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});return;}
  captured=scan;scan.visible=false;group.add(scan);
 });

 // Expansion joints, drain bars, bench fixings and curb wear have geometric depth.
 const seam=new THREE.MeshStandardMaterial({color:'#72766c',roughness:1});
 for(let x=-12;x<=12;x+=2)box(x,-.65,.001,.008,10.6,.002,seam,.001);
 for(let y=-5.95;y<=4.45;y+=2)box(0,y,.001,24,.008,.002,seam,.001);
 for(const x of [-5.5,6.5]){
  box(x,4.30,.002,.64,.30,.006,iron,.005);
  for(let j=0;j<10;j++)box(x-.28+j*.062,4.30,.009,.022,.29,.012,concrete,.003);
 }
 for(const x of [-1.75,-.25])for(let j=0;j<5;j++){
  const screw=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.003,8),iron);screw.rotation.x=Math.PI/2;screw.position.set(x,3.24+j*.12,.5);group.add(screw);
 }
 wood.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 woodPoint;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n woodPoint=position;');
  shader.fragmentShader='varying vec3 woodPoint;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n float grain=sin(woodPoint.y*550.+sin(woodPoint.x*4.)*3.+woodPoint.z*70.);diffuseColor.rgb*=.92+.08*grain;');
 };
 // Real bent grass blades along the verge; one mesh keeps draw cost bounded.
 const bladePositions:number[]=[],bladeColors:number[]=[],bladeIndices:number[]=[];
 for(let i=0;i<4800;i++){
  const x=(rand()-.5)*26,y=4.73+rand()*2.1,baseZ=-Math.min((y-4.6)*.17,1.6)-.03,h=.035+rand()*.09,w=.004+rand()*.007,angle=rand()*Math.PI*2,base=bladePositions.length/3;
  const color=new THREE.Color().setHSL(.19+rand()*.08,.24+rand()*.2,.17+rand()*.10);
  for(let j=0;j<3;j++){const t=j/2;for(const side of [-1,1]){bladePositions.push(x+Math.cos(angle)*w*side*(1-t)+Math.sin(angle)*t*t*.03,y+Math.sin(angle)*w*side*(1-t)+Math.cos(angle)*t*t*.03,baseZ+h*t);bladeColors.push(color.r,color.g,color.b);}if(j<2){const n=base+j*2;bladeIndices.push(n,n+1,n+2,n+1,n+3,n+2);}}
 }
 const bladeGeometry=new THREE.BufferGeometry();bladeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(bladePositions,3));bladeGeometry.setAttribute('color',new THREE.Float32BufferAttribute(bladeColors,3));bladeGeometry.setIndex(bladeIndices);bladeGeometry.computeVertexNormals();
 const blades=new THREE.Mesh(bladeGeometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,side:THREE.DoubleSide}));blades.receiveShadow=true;group.add(blades);
 const treesReady=new GLTFLoader().loadAsync('/assets/park-tree.glb').then(gltf=>{
  const source=gltf.scene;
  source.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.castShadow=o.receiveShadow=true;const materials=Array.isArray(o.material)?o.material:[o.material];const converted=materials.map(material=>{if(material instanceof THREE.MeshStandardMaterial){if(material.alphaTest>0)material=centralAvenueLeafMaterial(material);const m=material as THREE.MeshStandardMaterial;for(const t of [m.map,m.normalMap,m.roughnessMap,m.alphaMap])if(t){t.anisotropy=8;textures.push(t);}}return material;});o.material=Array.isArray(o.material)?converted:converted[0];});
  for(const [x,y,z,scale,angle]of [[-11,6,-.27,.72,.3],[12,8,-.61,.8,2.2],[-20,23,-1.63,.85,1.4],[23,26,-1.63,.9,3.1]]){
   const tree=source.clone(true);tree.rotation.x=Math.PI/2;tree.scale.setScalar(scale);tree.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(tree);tree.position.z=-bounds.min.z;
   const planting=new THREE.Group();planting.name='Authored park broadleaf';planting.position.set(x,y,z);planting.rotation.z=angle;planting.add(tree);if(!disposed)group.add(planting);
  }
 });
 const ready=Promise.all([scanReady,treesReady]);
 return {group,ground,ready,setSky(map:THREE.Texture,rotation:number){sky.material.dispose();sky.material=new THREE.MeshBasicMaterial({map,side:THREE.BackSide,depthWrite:false,fog:false});sky.rotation.set(Math.PI/2,rotation,0);},architectureVertices:architecture.userData.vertices,get scanVertices(){return scanVertices;},update(_t:number){},dispose(){disposed=true;architecture.userData.disposeTextures?.();window.removeEventListener('cortex-scene-reference',reference);textures.forEach(t=>t.dispose());}};
}
