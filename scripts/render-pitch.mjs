import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
await mkdir('public/media/slides',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});await page.goto('http://localhost:3000/pitch.html',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await page.pdf({path:'public/media/CORTEX-pitch.pdf',printBackground:true,preferCSSPageSize:true});
await page.addStyleTag({content:'.screen-nav{display:none}'});for(let i=0;i<5;i++)await page.locator('.slide').nth(i).screenshot({path:`public/media/slides/${i+1}.png`});await browser.close();console.log('Five-slide PDF and PNG previews generated.');
