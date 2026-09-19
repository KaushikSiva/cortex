import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {ROW_BASES,ROW_HEIGHTS,ROW_SPACING} from './siteAlignment';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Authored architectural study, NOT a surveyed reconstruction. Every building has
 * side/rear walls, a pitched roof and projecting bays; no facade image planes. */
export function buildVictorians(){
 const group=new THREE.Group();group.name='Painted Ladies · authored volumetric architecture';
 const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
 const textureLoader=new THREE.TextureLoader(),textures:THREE.Texture[]=[];
 const scan=(name:string,srgb=false)=>{const texture=textureLoader.load('/assets/architecture/'+name+'.jpg');texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=16;if(srgb)texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);return texture;};
 const siding={map:scan('siding-color',true),normalMap:scan('siding-normal'),roughnessMap:scan('siding-rough')};
 const roofing={map:scan('roof-color',true),normalMap:scan('roof-normal'),roughnessMap:scan('roof-rough')};
 group.userData.disposeTextures=()=>textures.forEach(t=>t.dispose());
 const add=(geo:THREE.BufferGeometry,material:THREE.Material,position:THREE.Vector3,rotation=new THREE.Euler())=>{
  geo.applyMatrix4(new THREE.Matrix4().compose(position,new THREE.Quaternion().setFromEuler(rotation),new THREE.Vector3(1,1,1)));
  // Metric planar UVs: the same scanned board/slate size on every building face.
  const pos=geo.getAttribute('position'),normals=geo.getAttribute('normal'),uv=geo.getAttribute('uv');
  for(let i=0;i<pos.count;i++){
   const nx=Math.abs(normals.getX(i)),ny=Math.abs(normals.getY(i)),nz=Math.abs(normals.getZ(i));
   if(nz>.8)uv.setXY(i,pos.getX(i)/2,pos.getY(i)/2);
   else uv.setXY(i,(nx>ny?pos.getY(i):pos.getX(i))/2,pos.getZ(i)/2);
  }
  // Consistent attributes allow many small details to share a single draw call.
  if(geo.index){const original=geo;geo=original.toNonIndexed();original.dispose();}
  const list=batches.get(material)??[];list.push(geo);batches.set(material,list);
 };
 const box=(m:THREE.Material,x:number,y:number,z:number,w:number,d:number,h:number,r=0)=>add(Math.min(w,d,h)>.06&&Math.max(w,d,h)<3?new RoundedBoxGeometry(w,d,h,1,.007):new THREE.BoxGeometry(w,d,h),m,new THREE.Vector3(x,y,z),new THREE.Euler(0,0,r));
 const bar=(m:THREE.Material,a:THREE.Vector3,b:THREE.Vector3,width:number,depth=width)=>{
  const g=new THREE.BoxGeometry(width,depth,a.distanceTo(b));const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),b.clone().sub(a).normalize());g.applyQuaternion(q);add(g,m,a.clone().add(b).multiplyScalar(.5));
 };
 const pbr=(color:string,roughness=.76,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const stone=pbr('#aca69b',.96),iron=pbr('#3a3a34',.48,.6),roof=new THREE.MeshStandardMaterial({...roofing,color:'#bab8b3',roughness:.88,normalScale:new THREE.Vector2(.45,.45)}),glass=new THREE.MeshPhysicalMaterial({color:'#ffffff',roughness:.075,metalness:0,ior:1.5,transmission:1,thickness:.008,envMapIntensity:.85}),room=pbr('#101512',1),curtain=pbr('#b5afa0',.96),brass=pbr('#8b7950',.28,.7);
 group.userData.setReflections=(map:THREE.Texture)=>{glass.envMap=map;glass.needsUpdate=true;};
 const palettes=[['#6c8263','#e6d5b3','#935d51'],['#898574','#ead9bd','#746455'],['#858a71','#e3d9bd','#555944'],['#c1aa76','#eee4cd','#984d38'],['#9fa5a7','#e0ddce','#798894'],['#95adb5','#e5e0d0','#668b94'],['#b1b091','#eae4cb','#9d6e4d']];
 // Published ground elevations establish the uphill row; facade geometry remains authored.
 palettes.forEach(([color,trimColor,accentColor],index)=>{
  const body=new THREE.MeshStandardMaterial({...siding,color,roughness:.87,normalScale:new THREE.Vector2(.23,.23)}),trim=pbr(trimColor,.68),accent=pbr(accentColor,.74);
  for(const material of [body,trim,accent]){
   material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 paintPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n paintPosition=position;');
    shader.fragmentShader='varying vec3 paintPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
     vec4 sampledDiffuseColor=texture2D(map,vMapUv);
     float pigment=clamp(dot(sampledDiffuseColor.rgb,vec3(.2126,.7152,.0722))*3.3,.48,1.35);
     diffuseColor.rgb*=mix(1.,pigment,.5);
     #endif`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n float weather=.985+.015*sin(paintPosition.x*9.1+sin(paintPosition.z*7.))*sin(paintPosition.z*24.);diffuseColor.rgb*=weather;');
   };
  }
  const cx=(index-3)*ROW_SPACING,fy=25.0+(index%2)*.14,base=ROW_BASES[index],w=5.95,depth=13.5;
  const eave=base+ROW_HEIGHTS[index]-2.75,peak=eave+2.75;
  // Ground floor, full sides/rear. Front upper wall has actual window openings.
  box(stone,cx,fy+depth/2,base+.75,w,depth,1.5);
  box(body,cx-w/2+.10,fy+depth/2,(base+1.5+eave)/2,.20,depth,eave-base-1.5);
  box(body,cx+w/2-.10,fy+depth/2,(base+1.5+eave)/2,.20,depth,eave-base-1.5);
  box(body,cx,fy+depth-.12,(base+1.5+eave)/2,w,.24,eave-base-1.5);
  const front=new THREE.Shape();front.moveTo(-w/2,1.5);front.lineTo(w/2,1.5);front.lineTo(w/2,eave-base);front.lineTo(-w/2,eave-base);front.closePath();
  const windowH=1.85,windowW=1.05;
  for(const z of [base+3.8,base+7.15])for(const dx of [-1.8,.65]){
   const hole=new THREE.Path();hole.moveTo(dx-windowW/2,z-base-windowH/2);hole.lineTo(dx-windowW/2,z-base+windowH/2);hole.lineTo(dx+windowW/2,z-base+windowH/2);hole.lineTo(dx+windowW/2,z-base-windowH/2);hole.closePath();front.holes.push(hole);
  }
  const wall=new THREE.ExtrudeGeometry(front,{depth:.2,bevelEnabled:false});wall.rotateX(Math.PI/2);add(wall,body,new THREE.Vector3(cx,fy,base));
  // Clapboard overlap in geometry: catches the directional sunlight and casts fine shadows.
  for(let z=base+1.6;z<eave;z+=.145){
   box(body,cx-w/2-.015,fy+depth/2,z,.028,depth,.023);
   box(body,cx+w/2+.015,fy+depth/2,z,.028,depth,.023);
   // Outside window spans, front boards remain true 3D trim rather than painted lines.
   const inWindow=[base+3.8,base+7.15].some(v=>Math.abs(z-v)<windowH/2+.05);
   if(!inWindow)box(body,cx,fy-.22,z,w,.035,.025);
   else for(const [a,b]of [[-w/2,-2.34],[-1.26,.11],[1.19,w/2]])box(body,cx+(a+b)/2,fy-.22,z,b-a,.035,.025);
  }
  for(const x of [cx-w/2+.05,cx+w/2-.05])box(trim,x,fy-.25,(base+1.5+eave)/2,.17,.10,eave-base-1.5);
  for(const z of [base+1.52,base+5.2,eave-.18,eave]){box(trim,cx,fy-.32,z,w+.24,.34,.17);box(trim,cx,fy+depth/2,z,w+.20,depth,.12);}
  // The corner house has a hipped roof; the other six have distinct gables.
  if(index===0){
   const roofFace=(corners:number[][])=>{
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(corners.flat(),3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(corners.flatMap(()=>[0,0]),2));
    geo.setIndex(corners.length===3?[0,1,2]:[0,1,2,0,2,3]);geo.computeVertexNormals();
    if(geo.getAttribute('normal').getZ(0)<0){geo.setIndex(corners.length===3?[2,1,0]:[2,1,0,3,2,0]);geo.computeVertexNormals();}
    add(geo,roof,new THREE.Vector3());
   };
   const left=cx-w/2-.28,right=cx+w/2+.28,front=fy-.35,back=fy+depth+.35;
   roofFace([[left,front,eave],[right,front,eave],[cx,fy+3,peak]]);
   roofFace([[left,front,eave],[cx,fy+3,peak],[cx,fy+depth-3,peak],[left,back,eave]]);
   roofFace([[right,front,eave],[right,back,eave],[cx,fy+depth-3,peak],[cx,fy+3,peak]]);
   roofFace([[left,back,eave],[cx,fy+depth-3,peak],[right,back,eave]]);
   for(const x of [cx-w/2+.35,cx+w/2-.35])box(trim,x,fy-.30,eave+.25,.045,.045,.50);
  }else{
   const gable=new THREE.Shape();gable.moveTo(-w/2,eave-base);gable.lineTo(w/2,eave-base);gable.lineTo(0,peak-base);gable.closePath();
   const ggeo=new THREE.ExtrudeGeometry(gable,{depth:.25,bevelEnabled:false});ggeo.rotateX(Math.PI/2);add(ggeo,body,new THREE.Vector3(cx,fy-.02,base));
   const rg=new THREE.ExtrudeGeometry(gable,{depth:.2,bevelEnabled:false});rg.rotateX(Math.PI/2);add(rg,body,new THREE.Vector3(cx,fy+depth,base));
   for(const sign of [-1,1]){
    const a=new THREE.Vector3(cx,fy+depth/2,peak+.10),b=new THREE.Vector3(cx+sign*(w/2+.28),fy+depth/2,eave-.1);
    bar(roof,a,b,.13,depth+.70);
    const frontPeak=new THREE.Vector3(cx,fy-.47,peak+.2),edge=new THREE.Vector3(cx+sign*(w/2+.3),fy-.47,eave-.10);
    bar(trim,frontPeak,edge,.17,.20);bar(accent,frontPeak.clone().add(new THREE.Vector3(0,-.10,-.24)),edge.clone().add(new THREE.Vector3(0,-.10,-.24)),.065,.10);
    for(let t=.08;t<1;t+=.065){const q=a.clone().lerp(b,t);box(roof,q.x,q.y,q.z+.08,.045,depth+.7,.025);}
   }
   box(trim,cx,fy-.45,peak+.40,.065,.065,.60);add(new THREE.SphereGeometry(.07,8,6),brass,new THREE.Vector3(cx,fy-.45,peak+.72));
  }
  // Chimney with coping, inset flue and flashing.
  box(accent,cx-1.7,fy+7,eave+1.5,.54,.7,1.5);box(stone,cx-1.7,fy+7,eave+2.27,.66,.82,.12);box(room,cx-1.7,fy+7,eave+2.34,.38,.5,.025);
  // Dentil/corbel eaves give a broken, shadowed silhouette.
  for(let x=-w/2+.15;x<w/2;x+=.24)box(trim,cx+x,fy-.43,eave-.25,.11,.34,.22);
  for(const x of [cx-w/2+.27,cx+w/2-.27])for(let j=0;j<3;j++)box(trim,x,fy-.28-j*.08,eave-.5+j*.10,.15,.19,.16);
  // Sash windows have glass, mullions, room depth, folded curtains and stepped sills.
  const windowAt=(x:number,y:number,z:number,ww:number,hh:number,angle=0)=>{
   const local=(m:THREE.Material,dx:number,dy:number,dz:number,bw:number,bd:number,bh:number)=>{const c=Math.cos(angle),s=Math.sin(angle);box(m,x+dx*c-dy*s,y+dx*s+dy*c,z+dz,bw,bd,bh,angle);};
   local(room,0,.20,0,ww+.03,.035,hh+.03);local(glass,0,.005,0,ww,.025,hh);
   for(const sign of [-1,1]){local(trim,sign*(ww/2+.065),-.045,0,.13,.12,hh+.25);local(trim,0,-.045,sign*(hh/2+.07),ww+.25,.12,.14);}
   local(trim,0,-.07,0,ww,.05,.055);local(trim,0,-.07,hh*.23,.025,.05,hh*.48);
   local(trim,0,-.13,-hh/2-.13,ww+.38,.32,.10);local(accent,0,-.03,hh/2+.19,ww+.40,.15,.09);
   // Individual rooms have open curtains, roller shades, or an unlit recess.
   const dressing=Math.abs(Math.round(x*7+z*3)+index)%5;
   if(dressing===1||dressing===3){
    const drop=dressing===1?.72:.38;
    local(dressing===1?curtain:accent,0,.10,hh*(1-drop)/2,ww-.025,.022,hh*drop);
    local(trim,0,.065,hh*(.5-drop),ww,.045,.025);
   }else if(dressing!==0){
    for(const side of [-1,1])for(let j=0;j<5;j++)local(curtain,side*(ww*.40-j*.042),.09,0,.055,.035+(j%2)*.03,hh*.95);
   }
  };
  windowAt(cx-1.8,fy-.245,base+7.15,windowW,windowH);
  // Polygonal two-story bay: three glazed faces project 1.15m from the facade.
  const bayCenter=cx+.67,bayFront=fy-1.28;
  for(const z of [base+3.8,base+7.15]){
   box(body,bayCenter,bayFront+.22,z-1.22,2.08,.55,.70);
   box(body,bayCenter,bayFront+.22,z+1.24,2.08,.55,.54);
   windowAt(bayCenter,bayFront-.025,z,1.3,windowH);
   for(const sign of [-1,1]){
    const angle=sign*Math.PI/4;
    const sx=bayCenter+sign*1.19,sy=bayFront+.49;
    box(body,sx,sy,z-1.22,.85,.13,.70,angle);box(body,sx,sy,z+1.24,.85,.13,.54,angle);
    windowAt(sx,sy-.025,z,.60,windowH,angle);
    box(trim,bayCenter+sign*.85,bayFront-.08,z,.13,.17,3.1);
   }
   for(const dz of [-1.55,1.52]){box(trim,bayCenter,bayFront+.40,z+dz,2.32,1.06,.14);box(accent,bayCenter,bayFront-.15,z+dz-.13,2.1,.08,.10);}
   for(let dx=-.8;dx<=.81;dx+=.32){box(trim,bayCenter+dx,bayFront-.065,z-1.2,.24,.045,.32);box(accent,bayCenter+dx,bayFront-.09,z-1.2,.15,.022,.23);}
  }
  if(index>0){
   // Ornament comes from observed building forms, never a projected facade photo.
   if(index>=5){windowAt(cx-.28,fy-.3,eave+1.08,.42,1.10);windowAt(cx+.28,fy-.3,eave+1.08,.42,1.10);}
   else windowAt(cx,fy-.3,eave+1.05,.84,.92);
   if(index===6){
    for(let z=.22;z<2.45;z+=.22){const half=(1-z/2.75)*w/2-.24;for(let x=-half;x<half;x+=.23){if(Math.abs(x)<.69&&z<1.85)continue;box(trim,cx+x,fy-.315,eave+z,.18,.045,.18);box(accent,cx+x,fy-.344,eave+z,.10,.018,.10);}}
   }else if(index===3||index===4){
    for(const sign of [-1,1]){
     const tri=new THREE.Shape();tri.moveTo(sign*.72,.22);tri.lineTo(sign*2.26,.22);tri.lineTo(sign*.72,1.75);tri.closePath();
     const geo=new THREE.ExtrudeGeometry(tri,{depth:.035,bevelEnabled:false});geo.rotateX(Math.PI/2);add(geo,index===3?accent:trim,new THREE.Vector3(cx,fy-.30,eave));
     bar(trim,new THREE.Vector3(cx+sign*.70,fy-.37,eave+.21),new THREE.Vector3(cx+sign*.70,fy-.37,eave+1.76),.055,.05);
    }
   }else{
    for(const sign of [-1,1])for(let t=.15;t<.91;t+=.115){
     const x=sign*t*(w/2-.24),z=2.55*(1-t);
     if(index===5)add(new THREE.SphereGeometry(.052,8,6),trim,new THREE.Vector3(cx+x,fy-.39,eave+z));
     else box(trim,cx+x,fy-.36,eave+.15,.07,.08,Math.max(.08,z-.25));
    }
   }
   // A pierced spindle frieze is three-dimensional and casts broken shadows.
   for(let x=-w/2+.25;x<w/2-.2;x+=.19){
    const z=eave-.56;box(trim,cx+x,fy-.51,z,.033,.06,.32);
    if(index%2===0)add(new THREE.SphereGeometry(.047,8,6),trim,new THREE.Vector3(cx+x,fy-.51,z));
   }
  }
  // Entry, stone stoop, newel posts and iron rails, all with physical thickness.
  const doorX=cx-1.83,doorBottom=base+1.55;
  box(accent,doorX,fy-.31,doorBottom+1.48,1.02,.12,2.96);
  windowAt(doorX,fy-.39,doorBottom+2.54,.72,.55);
  for(const dz of [.36,.94,1.72]){box(trim,doorX,fy-.39,doorBottom+dz,.75,.07,.46);box(accent,doorX,fy-.435,doorBottom+dz,.60,.025,.32);}
  add(new THREE.SphereGeometry(.04,8,6),brass,new THREE.Vector3(doorX+.32,fy-.48,doorBottom+1.0));
  // Rounded entry arches and turned porch posts catch softer highlights than boxes.
  for(const radius of [.58,.67])add(new THREE.TorusGeometry(radius,.045,8,32,Math.PI),trim,new THREE.Vector3(doorX,fy-.56,doorBottom+2.34),new THREE.Euler(Math.PI/2,0,0));
  for(const sign of [-1,1]){
   const px=doorX+sign*.64;
   add(new THREE.CylinderGeometry(.055,.07,2.26,12),trim,new THREE.Vector3(px,fy-.56,doorBottom+1.13),new THREE.Euler(Math.PI/2,0,0));
   for(const dz of [.08,.25,1.92,2.20])box(trim,px,fy-.56,doorBottom+dz,.16,.16,.10);
  }
  for(let step=0;step<9;step++){const h=(9-step)*.172;box(stone,doorX,fy-.48-step*.275,base+h/2,1.32,.29,h);}
  for(const sign of [-1,1]){
   const x=doorX+sign*.68;
   for(let j=0;j<5;j++){const y=fy-.42-j*.52,z=base+1.56-j*.33;box(iron,x,y,z+.40,.032,.032,.80);}
   bar(iron,new THREE.Vector3(x,fy-.42,base+2.42),new THREE.Vector3(x,fy-2.50,base+1.10),.045);
  }
  // Rear and side windows create parallax from the sixty-degree inspection angle.
  for(const side of [-1,1])for(const y of [fy+3,fy+6.5,fy+10])for(const z of [base+3.8,base+7.15])windowAt(cx+side*(w/2+.04),y,z,.85,1.6,side*Math.PI/2);
  // Downspout, collars and basement vents.
  box(accent,cx+w/2-.12,fy-.31,base+4.7,.06,.065,9.1);
  for(let z=base+.6;z<eave;z+=1.4)box(iron,cx+w/2-.12,fy-.34,z,.10,.035,.07);
  for(const x of [cx-.3,cx+1.4]){box(room,x,fy-.025,base+.60,.72,.04,.53);for(let j=0;j<6;j++)box(iron,x-.30+j*.12,fy-.06,base+.60,.02,.04,.53);}
 });
 let vertices=0;
 for(const [material,parts] of batches){const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());if(!geometry)continue;vertices+=geometry.getAttribute('position').count;const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
 group.userData.vertices=vertices;group.userData.provenance='Authored full-depth architectural approximation; no photograph projection, not surveyed';
 return group;
}
