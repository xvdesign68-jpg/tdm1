const http=require('http'),fs=require('fs'),path=require('path');
const root=process.cwd(), OUT=process.env.OUT;
const server=http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/') p='/app.html'; const f=path.join(root,p); if(f.endsWith('firebase-config.min.js')){ res.setHeader('content-type','text/javascript'); return res.end(process.env.LOGIN?'window.SL_CONFIG={MODE:"firebase",projectId:"PROJECT_ID",apiKey:"x",authDomain:"x",appId:"x"}':'window.SL_CONFIG={MODE:"demo"}'); } fs.readFile(f,(e,d)=>{ if(e){res.statusCode=404;return res.end();} const ext=path.extname(f); res.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'}[ext]||'application/octet-stream'); res.end(d); }); });
(async()=>{ const {chromium}=require('playwright-core'); const port=await new Promise(r=>server.listen(0,()=>r(server.address().port)));
 const base='/opt/pw-browsers'; let exe=null; for(const d of fs.readdirSync(base)){ for(const c of [`${base}/${d}/chrome-linux/headless_shell`,`${base}/${d}/chrome-linux/chrome`]) if(fs.existsSync(c)) exe=c; }
 const browser=await chromium.launch({executablePath:exe,headless:true});
 const errs=[];
 async function mk(w,h,scale){ const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:scale||1,hasTouch:w<700,isMobile:w<700}); const page=await ctx.newPage(); page.on('pageerror',e=>errs.push(e.message)); await page.goto(`http://localhost:${port}/app.html`,{waitUntil:'load'}); await page.waitForTimeout(1800); return {ctx,page}; }
 const shot=async(page,name)=>{ await page.screenshot({path:`${OUT}/${name}.png`,type:'png'}); console.log('shot',name); };
 const views=['overview','agency','feed','tasks','replies','pipeline','roi','sources','keywords','scoring','outreach','alerts','reports','history','scanned','integrations','users','account'];
 if(process.env.LOGIN){ const {page}=await mk(1440,900); await page.waitForTimeout(800); await shot(page,'login-desktop'); const m=await mk(390,844,2); await m.page.waitForTimeout(800); await shot(m.page,'login-mobile'); await browser.close(); server.close(); return; }
 // DESKTOP tall
 { const {page}=await mk(1440,2000);
   for(const v of views){ await page.click(`.nav-item[data-view="${v}"]`); await page.waitForTimeout(1300); await shot(page,`d-${v}`); }
   // modals & panels
   await page.click('.nav-item[data-view="feed"]'); await page.waitForTimeout(800);
   await page.click('#feedList .lead-card'); await page.waitForTimeout(900); await shot(page,'d-modal-lead');
   await page.keyboard.press('Escape'); await page.waitForTimeout(300);
   await page.click('#bellBtn'); await page.waitForTimeout(500); await shot(page,'d-bell'); await page.keyboard.press('Escape'); await page.click('#vTitle'); await page.waitForTimeout(300);
   await page.keyboard.press('Control+K'); await page.waitForTimeout(500); await shot(page,'d-palette'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
   await page.click('.nav-item[data-view="outreach"]'); await page.waitForTimeout(900);
   try{ await page.click('.oa-cfgbtn'); await page.waitForTimeout(600); await shot(page,'d-modal-brandcfg'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);}catch(e){console.log('no cfgbtn',e.message)}
   try{ const b=await page.$('[data-oa-content]')||await page.$('.oa-csbtn')||await page.$('button:has-text("✍️")'); if(b){ await b.click(); await page.waitForTimeout(700); await shot(page,'d-modal-content'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);} else console.log('no content btn'); }catch(e){console.log('content',e.message)}
   try{ const a=await page.$('[data-oa-add]')||await page.$('button:has-text("Thêm nick")'); if(a){ await a.click(); await page.waitForTimeout(600); await shot(page,'d-modal-addnick'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);} }catch(e){}
   await page.click('.nav-item[data-view="users"]'); await page.waitForTimeout(900);
   try{ const w=await page.$('button:has-text("✨")'); if(w){ await w.click(); await page.waitForTimeout(700); await shot(page,'d-modal-wizard1'); const nx=await page.$('#wzNext'); if(nx){ await page.fill('#wzName','Brand thử nghiệm').catch(()=>{}); await nx.click(); await page.waitForTimeout(600); await shot(page,'d-modal-wizard2'); } await page.keyboard.press('Escape'); await page.waitForTimeout(300);} else console.log('no wizard btn'); }catch(e){console.log('wizard',e.message)}
   try{ const add=await page.$('button:has-text("Thêm brand")'); if(add){ await add.click(); await page.waitForTimeout(600); await shot(page,'d-modal-addbrand'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);} }catch(e){}
   await page.click('.nav-item[data-view="sources"]'); await page.waitForTimeout(800);
   try{ const s=await page.$('button:has-text("Thêm nguồn")'); if(s){ await s.click(); await page.waitForTimeout(600); await shot(page,'d-modal-addsource'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);} }catch(e){}
   await page.click('#backfillBtn').catch(()=>{}); await page.waitForTimeout(600); await shot(page,'d-modal-backfill'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
   await page.click('.nav-item[data-view="pipeline"]'); await page.waitForTimeout(800);
   try{ await page.click('.kanban .kcard, .pv2-card, .kcard'); await page.waitForTimeout(800); await shot(page,'d-modal-lead-pipeline'); await page.keyboard.press('Escape'); }catch(e){console.log('pipeline card',e.message)}
   // account popover
   try{ const su=await page.$('#sideUser, .side-user, [data-acct]'); if(su){ await su.click(); await page.waitForTimeout(500); await shot(page,'d-acct-pop'); await page.keyboard.press('Escape'); } }catch(e){}
   // toast sample + fb-down banner
   await page.evaluate(()=>{ try{ window.dispatchEvent(new CustomEvent('sl-fb-down',{detail:{kind:'net'}})); }catch(e){} }); await page.waitForTimeout(400); await shot(page,'d-banner-net');
   await page.evaluate(()=>{ try{ window.dispatchEvent(new CustomEvent('sl-fb-up')); }catch(e){} });
   // feed empty state: filter with nonsense query
   await page.click('.nav-item[data-view="feed"]'); await page.waitForTimeout(600); await page.fill('#searchInput','zzzzqqq'); await page.waitForTimeout(700); await shot(page,'d-feed-empty'); await page.fill('#searchInput',''); await page.waitForTimeout(500);
   // brand with 0 leads (onboarding): set D.leads=[] then reload overview
   await page.click('.nav-item[data-view="overview"]'); await page.waitForTimeout(600);
   await page.evaluate(()=>{ const D=window.SL_DATA; window.__L=D.leads; D.leads=[]; D.kpi={...D.kpi,total:0,hot:0}; window.SLApp.reload(D); }); await page.waitForTimeout(800); await shot(page,'d-overview-empty');
   await page.evaluate(()=>{ const D=window.SL_DATA; D.leads=window.__L; window.SLApp.reload(D); });
   await page.close();
 }
 // DESKTOP normal height (fold view)
 { const {page}=await mk(1440,900); for(const v of ['overview','feed','pipeline','outreach','reports']){ await page.click(`.nav-item[data-view="${v}"]`); await page.waitForTimeout(1200); await shot(page,`f-${v}`); } await page.close(); }
 // MOBILE
 { const {page}=await mk(390,844,2);
   await shot(page,'m-overview');
   for(const v of ['feed','tasks','pipeline','outreach','users','reports','scanned','sources','roi']){ await page.evaluate((v)=>{ document.querySelector(`.nav-item[data-view="${v}"]`).click(); },v); await page.waitForTimeout(1100); await shot(page,`m-${v}`); }
   await page.evaluate(()=>{ document.querySelector('.nav-item[data-view="feed"]').click(); }); await page.waitForTimeout(700);
   await page.click('#feedList .lead-card'); await page.waitForTimeout(900); await shot(page,'m-modal-lead'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
   await page.click('#menuBtn'); await page.waitForTimeout(600); await shot(page,'m-drawer'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
   await page.click('#bellBtn').catch(()=>{}); await page.waitForTimeout(500); await shot(page,'m-bell');
   await page.close();
 }
 // MOBILE tall (see full pages)
 { const {page}=await mk(390,1900,1); for(const v of ['overview','feed','pipeline','outreach']){ await page.evaluate((v)=>{ document.querySelector(`.nav-item[data-view="${v}"]`).click(); },v); await page.waitForTimeout(1100); await shot(page,`mt-${v}`); } await page.close(); }
 console.log('errors:',errs); await browser.close(); server.close(); })();
