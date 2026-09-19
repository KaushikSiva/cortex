import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1440,height:1200},deviceScaleFactor:1});
page.on('pageerror',e=>console.log('ERROR',e.message));page.on('console',m=>{if(m.type()==='error')console.log(m.text())});
await page.goto('http://localhost:3000',{waitUntil:'networkidle'});await page.waitForTimeout(1500);await page.getByTitle('Reset simulation').click();await page.waitForTimeout(1500);await page.screenshot({path:'public/media/control-room.png',fullPage:true});console.log(await page.title());await browser.close();
