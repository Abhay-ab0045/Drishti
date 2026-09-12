const puppeteer = require('puppeteer');
const path = require('path');
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const extensionPath = path.resolve('D:\\Drishti\\extension\\dist');
  const browser = await puppeteer.launch({
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });

  await delay(2000);
  const targets = await browser.targets();
  const bgTarget = targets.find(t => t.type() === 'service_worker');
  const extensionId = bgTarget.url().split('/')[2];

  // Hook into background console
  const bgWorker = await bgTarget.worker();
  bgWorker.on('console', msg => console.log('BG LOG:', msg.text()));
  bgWorker.on('error', err => console.error('BG ERROR:', err.toString()));

  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('http://localhost:3000');
  await delay(2000);
  
  await browser.close();
})();
