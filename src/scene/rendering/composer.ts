import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/examples/jsm/postprocessing/SMAAPass.js';
import {AlphaAwareGTAOPass} from './alphaAwareGtao';

/** Chennai-GTA's contact shading pipeline, scaled for a walking humanoid. */
export function createSceneRenderer(scene:THREE.Scene,renderer:THREE.WebGLRenderer,camera:THREE.PerspectiveCamera){
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples)});
 const composer=new EffectComposer(renderer,target);
 const ao=new AlphaAwareGTAOPass(scene,camera,1,1);
 ao.updateGtaoMaterial({radius:.48,thickness:.28,distanceExponent:2,distanceFallOff:1,samples:12});
 ao.updatePdMaterial({radius:2,samples:6});ao.blendIntensity=.55;
 composer.addPass(new RenderPass(scene,camera));composer.addPass(ao);composer.addPass(new OutputPass());composer.addPass(new SMAAPass());
 return {render:()=>composer.render(),resize(w:number,h:number){composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(w,h);},dispose(){composer.passes.forEach(p=>p.dispose());composer.dispose();}};
}
