import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.evaluate(()=>fetch('/api/status').then(r=>r.json()));
const wait=async(fn)=>{const start=Date.now();while(!await fn()){if(Date.now()-start>20000)throw Error('Keyboard test timeout: '+JSON.stringify(await state()));await page.waitForTimeout(100);}};
const reset=async()=>{await page.getByTitle('Reset simulation').click();await wait(async()=>{const s=await state();return s.robot?.currentWaypoint==='HOME'&&s.robot?.status==='idle'&&!s.robot?.estop;});await page.waitForTimeout(300)};
try{
 await page.goto(process.env.CORTEX_TEST_URL??'http://localhost:3000',{waitUntil:'networkidle'});await wait(async()=>!!(await state()).robot);await reset();
 const initial=(await state()).robot.pose;
 await page.keyboard.down('w');await wait(async()=>(await state()).robot.motion==='drive');await page.waitForTimeout(1800);await page.keyboard.up('w');await wait(async()=>(await state()).robot.status==='idle');
 const forward=(await state()).robot.pose.x-initial.x;expect(forward).toBeGreaterThan(.4);
 await reset();await page.keyboard.down('a');await wait(async()=>(await state()).robot.motion==='turn');await wait(async()=>(await state()).robot.motion==='drive');
 const left=(await state()).robot.pose;expect(left.yaw).toBeGreaterThan(1.3);expect(Math.hypot(left.x+3,left.y)).toBeLessThan(.4);
 await wait(async()=>(await state()).robot.pose.y>.35);await page.keyboard.up('a');await wait(async()=>(await state()).robot.status==='idle');expect((await state()).robot.pose.y).toBeGreaterThan(.2);
 // Exercise right and backward translation, including the complete 180-degree turn.
 for(const [key,axis,sign]of [['d','y',-1],['s','x',-1]]){
  await reset();const start=(await state()).robot.pose;await page.keyboard.down(key);
  await wait(async()=>(await state()).robot.motion==='turn');await wait(async()=>(await state()).robot.motion==='drive');
  await wait(async()=>((await state()).robot.pose[axis]-start[axis])*sign>.3);
  await page.keyboard.up(key);await wait(async()=>(await state()).robot.status==='idle');
 }
 await reset();await page.keyboard.down('s');await wait(async()=>(await state()).robot.motion==='turn');await page.keyboard.up('s');await wait(async()=>(await state()).robot.status==='idle');await page.waitForTimeout(900);expect((await state()).robot.motion).toBe('hold');
 await page.keyboard.down('w');await wait(async()=>(await state()).robot.motion==='drive');await page.evaluate(()=>dispatchEvent(new Event('blur')));await wait(async()=>(await state()).robot.status==='idle');await page.keyboard.up('w');
 await page.keyboard.press('Space');await wait(async()=>((await state()).robot.status==='idle'));await expect(page.getByRole('button',{name:'Walk front',exact:true})).toBeEnabled();
 await reset();await page.getByRole('button',{name:'Turn right 90 degrees'}).click();await wait(async()=>(await state()).robot.pose.yaw < -1.3 && (await state()).robot.status==='idle');
 await reset();await page.getByRole('combobox',{name:'Navigation target'}).selectOption('BENCH');await page.locator('.target-controls button').click();await wait(async()=>(await state()).robot.currentWaypoint==='BENCH'&&(await state()).robot.status==='moving');
 const target=await state();expect(target.plan.some(t=>t.name==='walk_to'&&t.arguments.target==='BENCH')).toBeTruthy();expect(target.traces.some(t=>t.message.includes('shared motion gate'))).toBeTruthy();
 await page.keyboard.press('Space');await reset();await page.locator('input').fill('move left 1 meter');await page.locator('input').press('Enter');await wait(async()=>(await state()).robot.currentWaypoint==='DIRECTIONAL'&&(await state()).robot.motion==='walk');expect((await state()).plan[0].name).toBe('walk');await page.locator('input').evaluate(e=>e.blur());
 await page.keyboard.press('Space');await wait(async()=>((await state()).robot.status==='idle'));
 await page.getByTitle('60° orbit view').click();await page.waitForTimeout(700);expect(await page.locator('canvas').getAttribute('data-fov')).toBe('60');
 await page.screenshot({path:'public/media/keyboard.png',fullPage:true});expect(errors).toEqual([]);
 await writeFile('docs/keyboard-results.json',JSON.stringify({passed:true,forwardMeters:forward,tests:['held W moves; release pauses','A faces left before translation','D turns right and walks','S completes 180-degree turn and walks backward','key release cancels turning','blur pauses','Space cancels; next movement stays enabled','Q/E turn tool','target uses plan and shared reflex gate','text/voice planner reuses directional walk','60 degree view'],at:new Date().toISOString()},null,2));console.log('Keyboard and shared motion browser tests passed.');
}finally{await browser.close()}
