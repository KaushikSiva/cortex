import * as THREE from 'three';
import {z} from 'zod';
export const reconstructionManifest=z.object({url:z.string().startsWith('/assets/'),captureLocation:z.literal('Painted Ladies, Alamo Square'),source:z.string().min(1),license:z.string().min(1),anchorsVerified:z.literal(true),worldFromCapture:z.object({scale:z.number().positive().max(100),position:z.tuple([z.number(),z.number(),z.number()]),quaternion:z.tuple([z.number(),z.number(),z.number(),z.number()])})});
/** Appearance only. Physics remains explicit MuJoCo collision geometry. */
export async function loadReconstruction(scene:THREE.Scene,renderer:THREE.WebGLRenderer,manifestUrl:string){
 if(!manifestUrl.startsWith('/assets/'))throw new Error('Reconstruction manifest must be a local asset');
 const response=await fetch(manifestUrl);if(!response.ok)throw new Error('Reconstruction manifest unavailable');const manifest=reconstructionManifest.parse(await response.json());
 const {SparkRenderer,SplatMesh}=await import('@sparkjsdev/spark');
 const spark=new SparkRenderer({renderer});const splats=new SplatMesh({url:manifest.url});
 const t=manifest.worldFromCapture;splats.scale.setScalar(t.scale);splats.position.fromArray(t.position);splats.quaternion.fromArray(t.quaternion).normalize();
 scene.add(spark,splats);await splats.initialized;
 return {manifest,dispose(){scene.remove(spark,splats);splats.dispose();spark.dispose();}};
}
