/*jshint node:true, unused:true */
"use strict";

var redis = require('redis');
var fs = require('fs');
var path = require('path');

var scriptSha = null;

/**
 * Load the rate-limiter
 */
function loadScript(redisClient, callback) {
  var scriptFile = path.join(__dirname, '..', 'lua', 'limit.lua');

  fs.readFile(scriptFile, { encoding: 'utf8' }, function(err, contents) {
    if(err) return callback(err);

    redisClient.send_command('script', ['load', contents], function(err, sha) {
      if(err) return callback(err);

      scriptSha = sha;
      return callback();
    });

  });
}

/**
 * Execute the rate-limiter
 */
function runScript(key, expiry, redisClient, retries, callback) {
  redisClient.send_command('evalsha', [scriptSha, 1, key, expiry], function(err, value) {

    if(err) {
      if(retries > 0 && err.message.indexOf('NOSCRIPT') >= 0) {
        scriptSha = null;
        return loadAndRunScript(key, expiry, redisClient, retries - 1, callback);
      }

      return callback(err);
    }

    var count = value[0];
    var ttl = value[1];

    return callback(null, [count, ttl]);
  });
}

/**
 * Load and run the rate-limiter script
 */
function loadAndRunScript(key, expiry, redisClient, retries, callback) {
  if(!scriptSha) {
    loadScript(redisClient, function(err) {
      if(err) return callback(err);

      runScript(key, expiry, redisClient, retries, callback);
    });
  } else {
    runScript(key, expiry, redisClient, retries, callback);
  }
}

module.exports = function(options) {
  var redisClient;

  var prefix = options.prefix || '';

  // Redis client
  if(options.redisClient) {
    redisClient = options.redisClient;
  } else {
    var redisOptions = options.redis || {};

    redisClient = redis.createClient(redisOptions.port, redisOptions.host, redisOptions.options);
  }

  return function rateLimiter(key, expiry, callback) {
    loadAndRunScript(prefix + key, expiry, redisClient, 3, function(err, result) {
      if(err) return callback(err);

      var count = result[0];
      var ttl = result[1];

      return callback(null, count, ttl);
    });

  };
};
