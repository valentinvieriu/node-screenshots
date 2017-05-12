const fs     = require('fs');

const wrapWithPromise = wrappedFunction => (...args) => (
  new Promise((resolve, reject) => {
    wrappedFunction(...args, (err, result) => {
      return err ? reject(err) : resolve(result);
    });
  })
);


const readFilePromise = wrapWithPromise(fs.readFile);
const writeFilePromise = wrapWithPromise(fs.writeFile);
const statFilePromise = wrapWithPromise(fs.stat);

module.exports = {
    wrapWithPromise,
    readFilePromise,
    writeFilePromise,
    statFilePromise
}