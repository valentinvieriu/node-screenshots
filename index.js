const CDP = require('chrome-remote-interface');
const argv = require('minimist')(process.argv.slice(2));
const file = require('fs');

// CLI Args
const url = argv.url || 'https://www.google.com';
const format = argv.format === 'jpeg' ? 'jpeg' : 'png';
const viewportWidth = argv.viewportWidth || 1024;
const viewportHeight = argv.viewportHeight || 1024;
const delay = argv.delay || 0;
const userAgent = argv.userAgent;
const fullPage = argv.full;
let tabId;
CDP.List(function (err, targets) {
    if (!err) {
        console.log('Open Tabs: ', targets.length);
    }
});
CDP.New(function (err, target) {
    if (!err) {
        // console.log(target);
        tabId = target.id;
    }
});
// Start the Chrome Debugging Protocol
CDP(async function(client) {
  // Extract used DevTools domains.
  const {DOM, Emulation, Network, Page, Runtime} = client;

  // Enable events on domains we are interested in.
  await Page.enable();
  await DOM.enable();
  await Network.enable();

  // If user agent override was specified, pass to Network domain
  if (userAgent) {
    await Network.setUserAgentOverride({userAgent});
  }

  // Set up viewport resolution, etc.
  const deviceMetrics = {
    width: viewportWidth,
    height: viewportHeight,
    deviceScaleFactor: 0,
    mobile: false,
    fitWindow: false,
  };
  await Emulation.setDeviceMetricsOverride(deviceMetrics);
  await Emulation.setVisibleSize({width: viewportWidth, height: viewportHeight});

  try {
  await Page.navigate({url});
  } catch(error) {
    console.log(error);
  }
  // Navigate to target page
  setTimeout(() => {
      client.close();
      CDP.Close({'id': tabId}, function (err) {
          if (!err) {
              console.log('target is closing',tabId);
          }
      });
  },3000);
  // Wait for page load event to take screenshot
  Page.loadEventFired(async () => {
    // If the `full` CLI option was passed, we need to measure the height of
    // the rendered page and use Emulation.setVisibleSize
    if (fullPage) {
      const {root: {nodeId: documentNodeId}} = await DOM.getDocument();
      const {nodeId: bodyNodeId} = await DOM.querySelector({
        selector: 'body',
        nodeId: documentNodeId,
      });
      const {model: {height}} = await DOM.getBoxModel({nodeId: bodyNodeId});

      await Emulation.setVisibleSize({width: viewportWidth, height: height});
      // This forceViewport call ensures that content outside the viewport is
      // rendered, otherwise it shows up as grey. Possibly a bug?
      await Emulation.forceViewport({x: 0, y: 0, scale: 1});
    }

    setTimeout(async function() {
      const screenshot = await Page.captureScreenshot({format});
      const buffer = new Buffer(screenshot.data, 'base64');
      file.writeFile('output.'+format, buffer, 'base64', function(err) {
        if (err) {
          console.error(err);
        } else {
          console.log('Screenshot saved');
        }
        client.close();
        CDP.Close({'id': tabId}, function (err) {
            if (!err) {
                console.log('target is closing',tabId);
            }
        });
      });
    }, delay);
  });
}).on('error', err => {
  console.error('Cannot connect to browser:', err);
});
