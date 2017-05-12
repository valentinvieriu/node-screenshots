const http       = require('http');
const port       = process.env.PORT || 3000;
const fs         = require('fs');
const url        = require('url');
const path       = require('path');
const crypto     = require('crypto');
const emptyFile  = fs.readFileSync(`${__dirname}/empty.png`);
const helpers    = require('./helpers');

const CDP = require('chrome-remote-interface');

function loadForScreenshot(url) {
    const viewportWidth = 1024;
    const viewportHeight = 1024;

    return new Promise(async (resolve, reject) => {
        let tab, client;
        try {
            tab = await CDP.New({url:url});
            console.log(`Tab created: ${tab.id}`);
            client = await CDP({tab});
            const {Page, Emulation} = client;
            Page.loadEventFired(() => {
                resolve({client, tab});
            });
            await Page.enable();
            // Set up viewport resolution, etc.

            await Emulation.setDeviceMetricsOverride({
                width: 1024,
                height: 1024,
                deviceScaleFactor: 0,
                mobile: false,
                fitWindow: false,
            });
            await Emulation.setVisibleSize({width: 1024, height: 1024});
            await Page.navigate({url});


        } catch (err) {
            console.error(err);
            await closeTab(client,tab);
            reject({err, client, tab});
        }
    });
}

function closeTab(client,tab) {
    if (typeof(client) != "undefined") {
        return client.close();
    } else if (typeof(tab) != "undefined") {
        return CDP.Close({'id': tab.id});
    }
}

async function saveScreenshot(url) {
    return new Promise(async (resolve, reject) => {
        try {
            const {client, tab} = await loadForScreenshot(url);
            const {Page} = client;
            await CDP.Activate({id: tab.id});
            const result = await Page.captureScreenshot({format:'jpeg'});
            const image = Buffer.from(result.data, 'base64');
            const hashUrl = crypto.createHash("md5").update(url).digest("hex");
            const fileName = `${__dirname}/thumbnails/${hashUrl}.jpg`;
            // const fileName = `${__dirname}/thumbnails/${tab.id}.jpg`;
            await helpers.writeFilePromise(fileName, image, 'base64');
            console.log(`Saved Screenshot: ${fileName}`);
            await client.close();
            await CDP.Close({'id': tab.id});
            resolve({client, tab});
        } catch (err) {
            console.error(err);
            await closeTab(err.client,err.tab);
            reject(err);
        }
    });
}

const createScreenshot = async (url) => {
    // let tabId;
    const viewportWidth = 1024;
    const viewportHeight = 1024;
    const hashUrl = crypto.createHash("md5").update(url).digest("hex");
    const fileName = `${__dirname}/thumbnails/${hashUrl}.jpg`;

    console.log(url);

    try {
        const tab = await CDP.New();
        const client = await CDP({tab});
        console.log(`Tab Created: ${tab.id}`);
        // Extract used DevTools domains.
        const {DOM, Emulation, Network, Page} = client;
        const tabId = client.tab.id;
        // We close the connection if does not finish in 3 sec
        setTimeout(() => {
            client.close();
            // CDP.Close({'id': tabId}, function (err) {
            //     if (!err) {
            //         console.log('setTimeout closing of tab:',tabId);
            //     }
            // });
        },15*1000);
        // Enable events on domains we are interested in.
        await Page.enable();
        await DOM.enable();
        await Network.enable();

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

        await Page.navigate({url});

        // Wait for page load event to take screenshot
        Page.loadEventFired(async () => {
            await CDP.Activate({id: tab.id});
            const screenshot = await Page.captureScreenshot({format:'jpeg'});
            const buffer = new Buffer(screenshot.data, 'base64');
            // console.log(fileName);

            helpers.writeFilePromise(fileName, buffer, 'base64')
            .then( async () => {
                console.log(`Saved Screenshot: ${fileName}`);
                await client.close();
                // CDP.Close({'id': tabId}, function (err) {
                //     if (!err) {
                //         console.log(`File Saved: ${hashUrl} \n Chrome Tab : ${tabId} is closing.`);
                //     }
                // });
            })
            .catch( error => console.log(error));
        });
    } catch(error) {
        // something wrong with the client
        console.error(error);
        //closing the created tab
        if (typeof(tab) != "undefined") {
            CDP.Close({'id': tab.id}, function (err) {
                if (!err) {
                    console.log(`Tab :${tab.id} is closing because of an error: ${error.message}`);
                }
            });
        }
    }

};

async function cleanup() {
  console.log('Closing existing targets if any');
  const targets = await CDP.List();
  return Promise.all(targets.map(({id}) => CDP.Close({id})));
}

const requestHandler = async (request, response) => {
    const query = url.parse(request.url, true).query;
    const imgUrl = query.url;
    if (!imgUrl || imgUrl==='' || /\.pdf/.test(imgUrl)) {
        response.writeHead(200, {
            'Content-Type': 'image/png',
            'Cache-Control' : 'public, max-age=' + 7 * 24 * 60 * 60
        });
        response.write(emptyFile, 'binary');
        response.end();
        return;
    }
    const fileName = `${__dirname}/thumbnails/${crypto.createHash("md5").update(query.url).digest("hex")}.jpg`;
    try {
        const file = await helpers.readFilePromise(fileName);
        if (request.method === 'HEAD') {
            response.writeHead(200,{
                'Cache-Control' : 'no-cache, maxage=0'
            });
            response.end();
            return;
        }
        response.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Cache-Control' : 'public, max-age=' + 7 * 24 * 60 * 60
        });
        response.write(file, 'binary');
        response.end();
        return;
    } catch (error) {
        if (request.method === 'HEAD') {
            response.writeHead(201,{
                'Cache-Control' : 'no-cache, maxage=0'
            });
            response.end();
        } else {
            response.writeHead(201, {
                'Content-Type': 'image/png',
                'Cache-Control' : 'no-cache, maxage=0'
            });
            response.write(emptyFile, 'binary');
            response.end();
        }
        //we do the call
        // createScreenshot(query.url);
        saveScreenshot(query.url);
        return;
    }
}


const server = http.createServer(requestHandler)
server.maxConnections = 10000000;
server.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }

    console.log(`server is listening on ${port}`)
})
cleanup().then(async ()=>{
    // await CDP.New();
    for (let i=1;i<=10;i++) {
        // console.log(i);
        // createScreenshot('https://nlbooks.club/?page='+i);
        saveScreenshot('https://vue-hn.now.sh/top/'+i);
        // saveScreenshot('https://nlbooks.club/?page='+i);
    }
});
// let count = 1;
// setInterval(()=>{
//     saveScreenshot('https://nlbooks.club/?page='+count++);
// },500);