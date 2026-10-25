const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
await p.goto('file://'+process.argv[2]+'/deck.html');await p.evaluate(()=>document.fonts.ready);
await p.pdf({path:process.argv[2]+'/Hive-League-Pitch-Deck.pdf',width:'1920px',height:'1080px',printBackground:true});
const n=await p.$$eval('.slide',s=>s.length);
for(let i=0;i<n;i++){const el=(await p.$$('.slide'))[i];await el.screenshot({path:process.argv[2]+`/s${String(i+1).padStart(2,'0')}.png`});}
await b.close();console.log(n)})();
