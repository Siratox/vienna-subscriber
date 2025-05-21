import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import config from './config/environment.js';

dotenv.config();

(async () => {
  // Replace with your SOCKS proxy
  const proxy = process.env.TOR_PROXY_URI;

  const browser = await puppeteer.launch({
    headless: false, // or true
    args: [`--proxy-server=${proxy}`],
  });

  const page = await browser.newPage();

  // Optional: verify the IP to make sure the proxy is working
  await page.goto(config.WEBSITE_URL);

  //   await browser.close();
})();
