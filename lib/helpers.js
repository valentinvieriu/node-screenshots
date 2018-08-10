const _ = require('lodash');
const crypto = require('crypto');
const { exec } = require('child_process');

module.exports.generateFilename = function generateFilename(query) {
  const { rootPath } = process;
  const hashInput = _(query)
    .pick(['url', 'quality', 'width', 'height', 'resize'])
    .toPairs()
    .sortBy(0)
    .fromPairs()
    .value();
  const hashUrl = crypto
    .createHash('md5')
    .update(JSON.stringify(hashInput))
    .digest('hex');
  // console.log(hashUrl, JSON.stringify(hashInput));
  return `${rootPath}/screenshots/${hashUrl}`;
};
module.exports.deleteFiles = function deleteFiles(filename) {
  const shortName = filename.split('/').pop();
  const { rootPath } = process;
  exec(
    `find ${rootPath}/screenshots/ -name "${shortName}*" -type f -delete`,
    (err, stdout, stderr) => {
      if (err) {
        console.log(`Error Deleting ${shortName}: ${stderr}`);
      }
    }
  );
};
