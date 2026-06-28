import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  page.on('pageerror', (err) => {
    console.error('PAGE ERROR:', err.stack || err.message);
  });

  page.on('console', (msg) => {
    console.log('CONSOLE:', msg.text());
  });

  await page.goto('https://d2c9e1c1.xuepoo-blog.pages.dev/');
  await page.waitForTimeout(2000);
  await browser.close();
})().catch(console.error);
