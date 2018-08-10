const browserPagePool = require('./pool.js');

const getScreenshot = async ({ url, width = 1280, height = 1280, pageTimeout = 30 * 1000 }) => {
  const page = await browserPagePool.acquire();
  const { emptyFile } = process;
  const waitUntil = process.env.WAIT_UNTIL || 'networkidle2';
  const consoleLabel = `URL=${url} LOAD_TIME(${waitUntil})=`;
  let screenshot;
  console.time(consoleLabel);
  try {
    await page.setViewport({ width, height });
    await page.goto(url, {
      waitUntil,
      timeout: pageTimeout
    });
    console.timeEnd(consoleLabel);
    screenshot = await page.screenshot();
    await browserPagePool.release(page);
  } catch (error) {
    await browserPagePool.release(page);
    console.timeEnd(consoleLabel);
    screenshot = emptyFile;
  }
  return screenshot;
};

module.exports = {
  getScreenshot
};
