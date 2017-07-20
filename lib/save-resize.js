const sharp = require('sharp');
const { getScreenshot } = require('./remote-interface.js');
const { generateFilename } = require('./helpers');
const util = require('util');
const fs = require('fs');

const statFilePromise = util.promisify(fs.stat);
const writeFilePromise = util.promisify(fs.writeFile);

const saveScreenshot = async function saveScreenshot(query) {
  const fileName = generateFilename(query);
  let [resizeX, resizeY] = query.resize ? query.resize.split('x') : [null, null];
  resizeX = resizeX ? parseInt(resizeX, 10) : null;
  resizeY = resizeY ? parseInt(resizeY, 10) : null;
  const format = query.format || 'jpeg';
  const image = await getScreenshot(query);
  const [thumbResized, resized] = await Promise.all([
    sharp(image).resize(30, 30),
    sharp(image).resize(resizeX, resizeY),
  ]);
  return Promise.all([
    thumbResized.toFile(`${fileName}_t.jpeg`),
    resized.toFile(`${fileName}.${format}`),
    resized.toFile(`${fileName}.webp`),
  ])
  .then(() => Promise.resolve(`${fileName}.${format}`));
};

const saveEmptyScreenshot = async function saveEmptyScreenshot(query) {
  const fileName = generateFilename(query);
  const format = query.format || 'jpeg';
  const emptyFile = fs.readFileSync(`${process.rootPath}/empty.png`);
  try {
    const fileStats = await statFilePromise(fileName);
    if (fileStats.isFile()) return fileName;
  } catch (catchError) {
    console.log(`Clearing failed jobs. Adding empty image ${query.url}`);
    // we write an empty file so that if something fails in the screenshots,
    // next time we will not do the same call
    return Promise.all([
      writeFilePromise(`${fileName}_t.jpeg`, emptyFile).catch(error => console.error(`ERROR=[writeEmptyFile] ${error.message}`)),
      writeFilePromise(`${fileName}.${format}`, emptyFile).catch(error => console.error(`ERROR=[writeEmptyFile] ${error.message}`)),
    ]);
  }
  return fileName;
};
module.exports = {
  saveScreenshot,
  saveEmptyScreenshot,
};
