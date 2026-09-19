import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import data from '../../public/assets/neighborhood/buildings.json';
import {streetElevation} from './siteAlignment';

/** Actual DataSF footprints/elevations, with authored facade treatment.
 * Background context only: no claims of captured textures or reconstructed roofs. */
export function buildNeighborhood() {
  const group = new THREE.Group();
  group.name = 'DataSF · Alamo Square neighborhood massing';
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const walls = ['#b9b2a6', '#a9aaa2', '#c4bbac', '#bab8ae', '#a19e96', '#c2b8a8']
    .map(color => new THREE.MeshStandardMaterial({color, roughness: .93}));
  const roof = new THREE.MeshStandardMaterial({color: '#6c6b65', roughness: .96});
  const sill = new THREE.MeshStandardMaterial({color: '#c2beb2', roughness: .85});
  const glass = new THREE.MeshStandardMaterial({color: '#394846', roughness: .21, metalness: .15});
  const recess = new THREE.MeshStandardMaterial({color: '#292c29', roughness: .92});
  const append = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    if (geometry.index) {const previous = geometry; geometry = previous.toNonIndexed(); previous.dispose();}
    const batch = batches.get(material) ?? []; batch.push(geometry); batches.set(material, batch);
  };
  for (const [i, building] of data.buildings.entries()) {
    const paths = new THREE.ShapePath();
    for (const ring of building.rings) {
      paths.moveTo(ring[0][0], ring[0][1]);
      ring.slice(1).forEach(([x, y]) => paths.lineTo(x, y));
      paths.currentPath!.closePath();
    }
    const shapes = paths.toShapes();
    const geometry = new THREE.ExtrudeGeometry(shapes, {depth: building.height, bevelEnabled: false});
    geometry.translate(0, 0, building.base);
    append(geometry, walls[i % walls.length]);
    const cap = new THREE.ShapeGeometry(shapes); cap.translate(0, 0, building.base + building.height + .015); append(cap, roof);
    // Authored trim on the published footprints. High detail is limited to nearby
    // context, with outward normals derived from the exterior ring winding.
    const ring = building.rings[0];
    const winding = Math.sign(ring.slice(0,-1).reduce((sum,p,j)=>sum+p[0]*ring[j+1][1]-ring[j+1][0]*p[1],0)) || 1;
    const near = ring.some(([x,y])=>Math.hypot(x,y)<100);
    for (let j = 0; j < ring.length - 1; j++) {
      const [ax, ay] = ring[j], [bx, by] = ring[j + 1];
      const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
      if (length < 3) continue;
      const angle = Math.atan2(dy, dx), count = Math.floor(length / 2.5);
      const nx=dy/length*winding, ny=-dx/length*winding;
      const detail=(t:number,z:number,w:number,d:number,h:number,offset:number,material:THREE.Material)=>{
        const g=new THREE.BoxGeometry(w,d,h);g.rotateZ(angle);g.translate(ax+dx*t+nx*offset,ay+dy*t+ny*offset,z);append(g,material);
      };
      const top=building.base+building.height;
      if(near){
        // Coping, shadowed cornice, foundation band: no invented captured roof claim.
        detail(.5,top-.30,length+.08,.22,.20,.035,sill);
        detail(.5,top-.11,length+.16,.32,.09,.06,sill);
        detail(.5,building.base+.42,length,.12,.30,.035,walls[(i+2)%walls.length]);
        for(let z=building.base+3.82;z<top-1;z+=3.1)detail(.5,z,length,.10,.09,.02,sill);
      }
      for (let column = 0; column < count; column++) {
        const t = (column + .5) / count;
        for (let z = building.base + 2.3; z < top - 1.1; z += 3.1) {
          detail(t,z,1.04,.06,1.58,.035,recess);
          detail(t,z,.86,.035,1.38,.077,glass);
          detail(t,z-.8,1.17,.23,.10,.075,sill);
          if(near){
            for(const side of [-1,1])detail(t+side*.52/length,z,.075,.14,1.61,.085,sill);
            detail(t,z+.79,1.12,.18,.10,.085,sill);
            detail(t,z+.07,.93,.06,.042,.11,sill);
            if((column+i)%3===0)detail(t,z+.44,.84,.025,.48,.11,walls[(i+1)%walls.length]);
          }
        }
      }
    }
  }
  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries, false); geometries.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  }
  // Interpolate surrounding ground from published elevations. The foreground
  // apron and MuJoCo collision world are separate and remain unchanged.
  const samples = data.buildings.map(b => {
    const ring = b.rings[0];
    return {x: ring.reduce((s,p)=>s+p[0],0)/ring.length, y: ring.reduce((s,p)=>s+p[1],0)/ring.length, z: b.base};
  });
  const terrain = new THREE.PlaneGeometry(520, 360, 80, 60); terrain.translate(0, 203, 0);
  const points = terrain.getAttribute('position');
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), y = points.getY(i);
    const nearest = samples.map(p => ({...p, d: (x-p.x)**2+(y-p.y)**2})).sort((a,b)=>a.d-b.d).slice(0,4);
    let total = 0, weight = 0;
    for (const p of nearest) {const w = 1 / Math.max(1,p.d); total += p.z*w; weight += w;}
    const grade = total / weight;
    const blend = THREE.MathUtils.smoothstep(y, 23, 46);
    points.setZ(i, THREE.MathUtils.lerp(streetElevation(x), grade, blend) - .07);
  }
  terrain.computeVertexNormals();
  const ground = new THREE.Mesh(terrain, new THREE.MeshStandardMaterial({color: '#a4a099', roughness: 1}));
  ground.receiveShadow = true; group.add(ground);
  group.userData.buildingCount = data.buildings.length;
  return group;
}
