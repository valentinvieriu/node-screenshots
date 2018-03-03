// Packages
const kue = require('kue');
const redis = require('redis');
const fs = require('fs');
const util = require('util');
const cpus = require('os').cpus().length;
const { generateFilename } = require('./helpers');
const { saveScreenshot } = require('./save-resize.js');

const statFilePromise = util.promisify(fs.stat);
const concurentJobs = Number(process.env.WATCH_QUEUE) || cpus;

// Ours

// Config
const redisUrl = process.env.REDIS_URL || 'localhost';

let queue;

function flushDB() {
  const client = redis.createClient(redisUrl);
  client.flushall((err, replies) => {
    console.log('Flushing Redis:', err, replies);
    client.quit();
  });
}

function clearFailed(cb) {
  queue.failedCount('cacheImage', (err, total) => {
    if (total > 0) {
      kue.Job.rangeByState('failed', 0, total, 'asc', (error, jobs) => {
        jobs.forEach(async job => {
          const { query } = job.data;
          if (typeof cb === 'function') {
            cb(query);
          }
          job.remove(() => {
            console.log('\n Removed failed job ', job.id);
          });
        });
      });
    }
  });
}

function init() {
  queue = kue.createQueue({
    jobEvents: false,
    redis: redisUrl
  });
  queue.process('cacheImage', concurentJobs, async (job, done) => {
    const { query } = job.data;
    const format = query.format || 'jpeg';

    const fileName = `${generateFilename(query)}.${format}`;
    try {
      const fileStats = await statFilePromise(fileName);

      if (fileStats.isFile()) {
        console.log(`CACHE=cached JOB_ID=${job.id} URL=${query.url}`);
        done();
        return;
      }
    } catch (error) {
      // console.log('CACHE=not cached');
    }

    // Automatically acquires a phantom instance and releases it back to the
    // pool when the function resolves or throws
    console.log(`CACHE=not cached JOB_ID=${job.id} URL=${query.url}`);
    saveScreenshot(query)
      .then(() => {
        done();
      })
      .catch(error => {
        console.log('ERROR:', error);
        // response.statusCode = 404;
        // response.end();
        setTimeout(() => {
          done(error);
        }, 300);
      });
  });
}
module.exports = {
  init,
  flushDB,
  clearFailed,
  concurentJobs
};
