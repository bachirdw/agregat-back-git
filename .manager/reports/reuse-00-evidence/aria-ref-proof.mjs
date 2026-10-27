import http from 'node:http';
import { chromium } from 'playwright-core';
import { ownerTransport } from '../../../packages/browser-gateway/owner-transport.js';
const mode = process.argv[2];
const server = http.createServer((req,res)=>{
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(`<!doctype html><title>FICTIF ${req.url}</title><button id="go">FICTIF cliquez</button><output id="n">0</output><script>let n=0;document.querySelector('button').onclick=()=>document.querySelector('output').textContent=String(++n);setInterval(()=>history.replaceState({},'',location.pathname+'?tick='+Date.now()),100)</script>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/fictif`;
let browser,context,transport;
try {
  if(mode==='relay') { transport=await ownerTransport('http://127.0.0.1:19988'); browser=await chromium.connectOverCDP(transport.endpoint,{noDefaults:true,isLocal:true}); context=browser.contexts()[0]; }
  else { browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}); context=await browser.newContext(); }
  const page=await context.newPage();
  await page.goto(url);
  const snap=await page.ariaSnapshot({mode:'ai'});
  const ref=snap.split('\n').find(x=>x.includes('button "FICTIF cliquez"'))?.match(/\[ref=([^\]]+)\]/)?.[1];
  console.log(JSON.stringify({mode,step:'snapshot',ref,hasRef:!!ref,excerpt:snap.split('\n').find(x=>x.includes('FICTIF cliquez'))}));
  if(!ref) throw new Error('Aucune aria-ref');
  try { await page.locator(`aria-ref=${ref}`).click({timeout:3000}); console.log(JSON.stringify({mode,step:'default-click',result:'clicked'})); }
  catch(e) { console.log(JSON.stringify({mode,step:'default-click',result:'error',error:e.message.slice(0,180)})); }
  try { await page.locator(`aria-ref=${ref}`).click({timeout:3000,force:true}); console.log(JSON.stringify({mode,step:'forced-click',result:'clicked'})); }
  catch(e) { console.log(JSON.stringify({mode,step:'forced-click',result:'error',error:e.message.slice(0,180)})); }
  console.log(JSON.stringify({mode,step:'first-click',count:await page.locator('#n').textContent()}));
  await page.ariaSnapshot({mode:'ai'});
  try {await page.locator(`aria-ref=${ref}`).click({timeout:1000}); console.log(JSON.stringify({mode,step:'after-new-snapshot',result:'clicked',count:await page.locator('#n').textContent()}));} catch(e){console.log(JSON.stringify({mode,step:'after-new-snapshot',result:'error',error:e.message.slice(0,180)}));}
  const other=await context.newPage(); await other.goto(url); await page.bringToFront(); await other.bringToFront();
  const hiddenSnap=await page.ariaSnapshot({mode:'ai'});
  const hiddenRef=hiddenSnap.split('\n').find(x=>x.includes('button "FICTIF cliquez"'))?.match(/\[ref=([^\]]+)\]/)?.[1];
  try {await page.locator(`aria-ref=${hiddenRef}`).click({timeout:3000}); console.log(JSON.stringify({mode,step:'hidden-click',result:'clicked',count:await page.locator('#n').textContent()}));}catch(e){console.log(JSON.stringify({mode,step:'hidden-click',result:'error',error:e.message.slice(0,180)}));}
  try {await page.locator(`aria-ref=${hiddenRef}`).evaluate(el=>el.click()); console.log(JSON.stringify({mode,step:'hidden-dom-click',result:'clicked',count:await page.locator('#n').textContent()}));}catch(e){console.log(JSON.stringify({mode,step:'hidden-dom-click',result:'error',error:e.message.slice(0,180)}));}
  await page.goto(url+'/next');
  try {await page.locator(`aria-ref=${hiddenRef}`).click({timeout:1000}); console.log(JSON.stringify({mode,step:'after-navigation',result:'clicked',count:await page.locator('#n').textContent()}));}catch(e){console.log(JSON.stringify({mode,step:'after-navigation',result:'error',error:e.message.slice(0,180)}));}
  await other.close(); await page.close();
} finally {await browser?.close().catch(()=>{}); await transport?.close().catch(()=>{}); server.closeAllConnections(); await new Promise(r=>server.close(r));}
