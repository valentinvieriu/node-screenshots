const genericPool = require('generic-pool');
const puppeteer = require('puppeteer');

// puppeteer.launch will return a promise to resolve with a browser instance
const browserPromise = () =>
  puppeteer.launch({
    // executablePath: 'google-chrome-unstable',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--headless',
      '--disable-gpu',
      '--ignore-certificate-errors',
      '--hide-scrollbars',
      '--incognito',
      '--window-size=1280,1280',
      '--remote-debugging-address=0.0.0.0',
      '--remote-debugging-port=9222'
    ]
  });

const factory = {
  async create() {
    const browser = await browserPromise();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1280 });
    return page;
  },
  destroy(puppeteerInstance) {
    puppeteerInstance.close();
  }
};

const browserPagePool = genericPool.createPool(factory, {
  max: Number(process.env.WATCH_QUEUE) || 3,
  min: 1,
  maxWaitingClients: 10
});

// https://stackoverflow.com/questions/14031763/doing-a-cleanup-action-just-before-node-js-exits
// process.stdin.resume(); //so the program will not close instantly

function exitHandler(options, err) {
  if (options.cleanup) console.log('clean');
  if (err) console.log(err.stack);
  browserPagePool.drain().then(() => {
    browserPagePool.clear();
  });
  if (options.exit) process.exit();
}

// do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }));

// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

// catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));

module.exports = browserPagePool;
