const browserPagePool = require('./pool.js');
const fs = require('fs');

const emptyFile = fs.readFileSync(`${__dirname}/../empty.png`);

const getScreenshot = async ({ url, pageTimeout = 10 * 1000 }) => {
  const page = await browserPagePool.acquire();
  let screenshot;
  console.time(url);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: pageTimeout });
    console.timeEnd(url);
    screenshot = await page.screenshot();
    await browserPagePool.release(page);
  } catch (error) {
    await browserPagePool.release(page);
    console.timeEnd(url);
    screenshot = emptyFile;
  }
  return screenshot;
};

module.exports = {
  getScreenshot
};
