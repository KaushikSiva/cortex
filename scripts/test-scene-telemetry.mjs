import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const base=process.env.CORTEX_TEST_URL??'http://localhost:3000';
const snapshot=await(await fetch(base+'/api/status')).json();
if(!snapshot.robot)throw new Error('A live robot snapshot is required for the visual alignment check');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 let available=false;
 // Exercise the actual rejected-second-tab UI without taking robot control.
 await page.route('**/api/status',route=>route.fulfill({json:{...snapshot,robot:available?snapshot.robot:null}}));
 await page.routeWebSocket('**/ws',ws=>ws.close({code:1008,reason:'One operator at a time'}));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await expect(page.locator('.header-status')).toContainText('VIEW ONLY');
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.robotVisible==='false',null,{timeout:60000});
 await expect(page.locator('.robot-offline')).toContainText('Robot controller offline');
 available=true;
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.robotVisible==='true');
 await expect(page.locator('.robot-offline')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Walk front',exact:true})).toBeDisabled();
 await expect(page.locator('.error-banner')).toContainText('View only: another tab controls this robot');
 await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.robotRootHeight)>.5);
 const measured=await page.locator('canvas').evaluate(c=>({rootZ:Number(c.dataset.robotRootHeight),lowestVisualVertexZ:Number(c.dataset.robotMinZ)}));
 expect(measured.rootZ).toBeCloseTo(snapshot.robot.qpos[2],3);
 expect(measured.lowestVisualVertexZ).toBeGreaterThan(-.04);
 expect(measured.lowestVisualVertexZ).toBeLessThan(.12);
 available=false;
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.robotVisible==='false');
 expect(errors).toEqual([]);
 const result={at:new Date().toISOString(),passed:true,errors,measured,tests:['No robot rendered before valid telemetry','Rejected operator tab receives read-only HTTP telemetry','Healthy controller is not labeled offline in observer tab','Observer movement controls remain disabled','Rendered robot pelvis matches actual MuJoCo qpos','Visual lowest vertex near z=0 collision ground','Telemetry loss hides the stale robot'],scope:'Actual browser renderer and live snapshot; locally routed status availability and operator rejection; no control commands.'};
 await writeFile('docs/scene-telemetry-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
