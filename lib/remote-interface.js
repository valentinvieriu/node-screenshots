const CDP = require('chrome-remote-interface');
const ms = require('ms');

const config = {
  host: process.env.REMOTE_HOST || 'localhost',
  port: process.env.REMOTE_PORT || 9222,
};

function closeTab(client, tab) {
  if (typeof client !== 'undefined') {
    return client.close();
  } else if (typeof tab !== 'undefined') {
    return CDP.Close({
      id: tab.id,
    });
  }
  return false;
}

function loadForScreenshot({ url, inputWidth = 1280, inputHeight = 1280 }) {
  const width = parseInt(inputWidth, 10);
  const height = parseInt(inputHeight, 10);
  const forcedTimeout = ms('10s');

  return new Promise(async (resolve, reject) => {
    let tab;
    let client;
    let timer;
    try {
      tab = await CDP.New({ ...config, url });
      // console.log(`Tab created: ${tab.id}`);
      client = await CDP({
        ...config,
        tab,
      });
      const { Page, Emulation } = client;
      timer = setTimeout(async () => {
        console.log('Forced Timeout');
        resolve({ client, tab });
      }, forcedTimeout);
      Page.loadEventFired(({ timestamp }) => {
        // console.info(`${url} loaded after: ${timestamp} ms`);
        clearTimeout(timer);
        resolve({ client, tab });
      });
      Page.domContentEventFired(({ timestamp }) => {
        // console.info(`${url} domContentEventFired: ${timestamp} ms`);
        clearTimeout(timer);
        resolve({ client, tab });
      });
      await Page.enable();
      // Set up viewport resolution, etc.

      await Emulation.setDeviceMetricsOverride({
        width,
        height,
        deviceScaleFactor: 0,
        mobile: false,
        fitWindow: false,
      });
      await Emulation.setVisibleSize({
        width,
        height,
      });
      await Page.navigate({
        url,
      });
    } catch (err) {
      console.error('err', err);
      clearTimeout(timer);
      await closeTab(client, tab);
      reject({
        err,
        client,
        tab,
      });
    }
  });
}

const getScreenshot = async function saveScreenshot(query) {
  return new Promise(async (resolve, reject) => {
    try {
      const { client, tab } = await loadForScreenshot(query);
      const { Page } = client;
      await CDP.Activate({
        ...config,
        id: tab.id,
      });
      const result = await Page.captureScreenshot({
        format: 'jpeg',
        fromSurface: true,
        quality: +query.quality || 100,
      });

      const image = Buffer.from(result.data, 'base64');

      await client.close();
      await CDP.Close({
        ...config,
        id: tab.id,
      });
      resolve(image);
    } catch (err) {
      console.error(err);
      await closeTab(err.client, err.tab);
      reject(err);
    }
  });
};

const cleanup = async function cleanup() {
  console.log('Closing existing targets if any');
  const targets = await CDP.List(config);
  return Promise.all(
    targets.map(({ id }) => {
      const tab = {
        ...config,
        id,
      };
      return CDP.Close(tab, error => error && console.error('Error closing tab', error));
    }),
  );
};

const tabsStatus = () => CDP.List(config);

module.exports = {
  getScreenshot,
  cleanup,
  tabsStatus,
};
