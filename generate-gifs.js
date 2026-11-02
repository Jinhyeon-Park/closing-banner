const puppeteer = require('puppeteer');
const GIFEncoder = require('gif-encoder-2');
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');
const GIF_PAGES = [{ url: 'https://jinhyeon-park.github.io/closing-banner/index-1.html', output: 'index-1.gif', width: 860, selector: '.banner' }];
const FPS=5, DURATION_SEC=6, TOTAL_FRAMES=FPS*DURATION_SEC, FRAME_DELAY=1000/FPS;
async function generateGif(page,config){
  await page.setViewport({width:config.width,height:343,deviceScaleFactor:1});
  await page.emulateTimezone('Asia/Seoul');
  const response=await page.goto(config.url,{waitUntil:'networkidle0',timeout:60000});
  if(!response||!response.ok())throw new Error('Banner load failed');
  await page.waitForFunction(()=>window.bannerReady===true,{timeout:60000});
  const box=await page.$(config.selector);if(!box)throw new Error('Banner missing');
  const bounds=await box.boundingBox();const height=Math.round(bounds.height);
  const dateText=await page.$eval('#deadlineText',el=>el.textContent);
  console.log('Rendered date (Asia/Seoul):',dateText);
  const encoder=new GIFEncoder(config.width,height);encoder.setDelay(FRAME_DELAY);encoder.setRepeat(0);encoder.setQuality(10);encoder.start();
  // Pause and seek CSS animation: capture latency cannot alter blink timing.
  for(let i=0;i<TOTAL_FRAMES;i++){
    await page.evaluate(ms=>{for(const animation of document.querySelector('#deadlineText').getAnimations()){animation.pause();animation.currentTime=ms;}},i*FRAME_DELAY);
    const image=await box.screenshot({type:'png'});const png=PNG.sync.read(image);
    if(png.width!==config.width||png.height!==height)throw new Error('Unexpected capture dimensions');
    encoder.addFrame(png.data);
  }
  encoder.finish();const output=path.join(__dirname,config.output);fs.writeFileSync(output,encoder.out.getData());
  console.log('Saved',config.output,config.width+'x'+height,fs.statSync(output).size+' bytes');
}
(async()=>{const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});try{const page=await browser.newPage();for(const config of GIF_PAGES)await generateGif(page,config);}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
