// Two real browser tabs and the isolated MuJoCo controller; never drive the user's instance.
import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const url=process.env.CORTEX_TEST_URL;
if(!url||new URL(url).port==='3000')throw Error('Set CORTEX_TEST_URL to an isolated runtime');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
// Control/transport regression: freeze render animation so simultaneous GPU scenes
// cannot starve the 650 ms keyboard lease. Visual rendering has separate coverage.
await context.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
const a=await context.newPage(),b=await context.newPage(),errors=[];
for(const page of [a,b])page.on('pageerror',e=>errors.push(e.message));
const state=()=>fetch(`${url}/api/status`).then(r=>r.json());
const until=async predicate=>{await expect.poll(predicate,{timeout:20000,intervals:[100]}).toBeTruthy();};
const walk=page=>page.getByRole('button',{name:'Walk front',exact:true});
try{
 await a.goto(url);await expect(walk(a)).toBeEnabled({timeout:60000});
 await a.getByTitle('Reset simulation').click();await until(async()=>{const r=(await state()).robot;return r?.currentWaypoint==='HOME'&&r.status==='idle';});
 await b.goto(url);await expect(b.locator('.phase')).toHaveText('VIEW ONLY',{timeout:60000});
 await expect(walk(b)).toBeDisabled();
 await b.getByRole('button',{name:'Use this tab',exact:true}).click();
 await expect(walk(b)).toBeEnabled();await expect(a.locator('.phase')).toHaveText('VIEW ONLY');
 await expect(walk(a)).toBeDisabled();
 await until(async()=>(await state()).robot?.status==='idle');
 const before=(await state()).robot.pose;
 await b.keyboard.down('w');await until(async()=>(await state()).robot?.motion==='drive');
 await a.close(); // Former owner's cleanup must not clear or stop the new controller.
 await until(async()=>{const r=(await state()).robot;return Math.hypot(r.pose.x-before.x,r.pose.y-before.y)>.35;});
 await b.keyboard.up('w');await until(async()=>(await state()).robot?.status==='idle');
 const after=(await state()).robot.pose;
 await b.reload();await expect(walk(b)).toBeEnabled({timeout:20000});
 await b.keyboard.down('w');await until(async()=>(await state()).robot?.motion==='drive');
 await b.keyboard.up('w');await until(async()=>(await state()).robot?.status==='idle');
 // Transfer while moving must stop before granting the next tab.
 const c=await context.newPage();c.on('pageerror',e=>errors.push(e.message));await c.goto(url);
 await expect(c.locator('.phase')).toHaveText('VIEW ONLY',{timeout:60000});
 await b.keyboard.down('w');await until(async()=>(await state()).robot?.motion==='drive');
 await c.getByRole('button',{name:'Use this tab',exact:true}).click();
 await expect(walk(c)).toBeEnabled();await expect(b.locator('.phase')).toHaveText('VIEW ONLY');
 await until(async()=>(await state()).robot?.status==='idle');await b.keyboard.up('w');
 await c.getByTitle('Reset simulation').click();await until(async()=>(await state()).robot?.currentWaypoint==='HOME');
 expect(errors).toEqual([]);
 await writeFile('docs/control-transfer-results.json',JSON.stringify({passed:true,renderAnimation:'disabled for control regression; separate visual coverage',at:new Date().toISOString(),movedMeters:Math.hypot(after.x-before.x,after.y-before.y),tests:['second tab is read only','explicit transfer enables keyboard controls','previous owner becomes read only','former tab closure cannot interrupt new owner','reload restores controls','transfer while walking stops robot before handoff'],pageErrors:errors},null,2));
 console.log('PASS: real two-tab transfer, MuJoCo movement, old-tab cleanup, reload and stop-on-handoff.');
}finally{await browser.close();}
