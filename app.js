const http = require('http');
const fs = require('fs');
const util = require('util');
const URL = require('url');
const { generateFilename } = require('./lib/helpers');
const que = require('./lib/queue');
const { exec } = require('child_process');
const ms = require('ms');

const { saveScreenshot, saveEmptyScreenshot } = require('./lib/save-resize.js');
const { cleanup, tabsStatus, concurentJobs } = require('./lib/remote-interface.js');

const readFilePromise = util.promisify(fs.readFile);
const port = process.env.PORT || 3000;
const emptyFile = fs.readFileSync(`${__dirname}/empty.png`);
const imageCache = 7 * 24 * 60 * 60;
process.rootPath = __dirname;

const requestHandler = async (request, response) => {
  if (request.url.includes('/healthcheck')) {
    tabsStatus().then(() => {
      response.statusCode = 201;
      response.end();
    })
    .catch(() => {
      response.statusCode = 500;
      response.end();
    });
    return;
  }
  if (!request.url.includes('/capture')) {
    response.statusCode = 404;
    response.end('Not Found');
    return;
  }
  const query = URL.parse(request.url, true).query;
  const format = query.format || 'jpeg';
  const isThumbRequest = query.thumb || false;
  const imgUrl = query.url;
  if (!imgUrl || imgUrl === '' || /\.pdf/.test(imgUrl)) {
    response.writeHead(200, {
      'Content-Type': `image/${format}`,
      'Cache-Control': `public, max-age=${imageCache}`,
    });
    response.write(emptyFile, 'binary');
    response.end();
    return;
  }
  const fileName = `${generateFilename(query)}${isThumbRequest ? '_t' : ''}.${isThumbRequest ? 'jpeg' : format}`;
  try {
    const file = await readFilePromise(fileName);
    if (request.method === 'HEAD') {
      response.writeHead(200, {
        'Cache-Control': 'no-cache, maxage=0',
      });
      response.end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': `image/${format}`,
      'Cache-Control': `public, max-age=${imageCache}`,
    });
    response.write(file, 'binary');
    response.end();
    return;
  } catch (readError) {
    if (request.method === 'HEAD') {
      response.writeHead(201, {
        'Cache-Control': 'no-cache, maxage=0',
      });
      response.end();
    } else {
      saveScreenshot(query)
        .then(async (savedFilename) => {
          const file = await readFilePromise(savedFilename);
          response.writeHead(200, {
            'Content-Type': `image/${format}`,
            'Cache-Control': `public, max-age=${imageCache}`,
          });
          response.write(file, 'binary');
          response.end();
        })
        .catch((error) => {
          console.error(error);
          response.end('500', error);
        });
    }
  }
};

const server = http.createServer(requestHandler);
server.maxConnections = 10000000;
server.listen(port, (err) => {
  if (err) {
    console.log('Server Error:', err);
  }

  console.log(`Server is listening on ${port}`);
});

// we close all tabs and schedule the cleaning task
let openTabs = 0;
let similarTabsCount = 1;
cleanup().then(async () => {
  setInterval(async () => {
    const tabs = await tabsStatus();
    const currentOpenTabs = tabs.length;
    console.log(`OPEN_TABS: ${currentOpenTabs}`);

    if (currentOpenTabs > 1 && (currentOpenTabs === openTabs)) {
      similarTabsCount += 1;
    } else {
      similarTabsCount = 1;
    }
    openTabs = currentOpenTabs;
    if ((similarTabsCount > 5) || openTabs > (concurentJobs * 2)) {
      console.log('Too many open tabs!!');
      await cleanup();
      openTabs = 0;
      similarTabsCount = 1;
    }
  }, ms('30s'));
  const cleanDaysTimeout = Number(process.env.FILES_CLEAN_TIMEOUT) || 1;
  const watchQueue = Number(process.env.WATCH_QUEUE) || 0;

  // Cleaning up the old images every 10 days
  if (cleanDaysTimeout) {
    setInterval(() => {
      exec(`find ${__dirname}/screenshots/ -mtime +${cleanDaysTimeout} -type f -delete`, (err, stdout, stderr) => {
        if (err) {
          console.log(`Error Deleting old images: ${stderr}`);
        } else {
          console.log(`10 days old images deleted~ ${stdout}`);
        }
      });
    }, ms(`${cleanDaysTimeout}d`));
  }

  // we watch the que and save the files
  if (watchQueue) {
    // que.flushDB();
    que.init();
    setInterval(() => {
      que.clearFailed(saveEmptyScreenshot);
    }, ms('1m'));
  }
});
