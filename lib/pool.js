const genericPool = require('generic-pool');
const puppeteer = require('puppeteer');

const MAX_POOL_SIZE = Number(process.env.WATCH_QUEUE) || 3;
// puppeteer.launch will return a promise to resolve with a browser instance
debugger;
const browserPromise = puppeteer.launch({
  executablePath: process.env.CHROME_PATH,
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
    const browser = await browserPromise;
    const page = await browser.newPage();
    return page;
  },
  destroy(puppeteerInstance) {
    puppeteerInstance.close();
  }
};

const browserPagePool = genericPool.createPool(factory, {
  max: MAX_POOL_SIZE,
  min: 0,
  maxWaitingClients: 10 * MAX_POOL_SIZE,
  evictionRunIntervalMillis: 5 * 1000
});

// We send status to console
setInterval(() => {
  const { spareResourceCapacity, size, available, borrowed, pending, max } = browserPagePool;
  console.log(
    `POOL_SPARE_RESOURCE_CAPACITY=${spareResourceCapacity} POOL_SIZE=${size} POOL_AVAILABLE=${available} POOL_BORROWED=${borrowed} POOL_PENDING=${pending} POOL_MAX=${max}`
  );
}, 60 * 1000);

// https://stackoverflow.com/questions/14031763/doing-a-cleanup-action-just-before-node-js-exits
// process.stdin.resume(); //so the program will not close instantly

// function exitHandler(options, err) {
//   if (process.env.NODE_ENV === 'development') return;
//   if (options.cleanup) console.log('exitHandler clean');
//   if (err) console.log('exitHandler', err.stack);
//   browserPagePool.drain().then(() => {
//     browserPagePool.clear();
//   });
//   if (options.exit) process.exit();
// }

// // do something when app is closing
// process.on('exit', exitHandler.bind(null, { cleanup: true }));

// // catches ctrl+c event
// process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// // catches "kill pid" (for example: nodemon restart)
// process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
// process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

// // catches uncaught exceptions
// process.on('uncaughtException', exitHandler.bind(null, { exit: true }));

module.exports = browserPagePool;
