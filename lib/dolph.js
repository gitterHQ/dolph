/*jshint node:true */
"use strict";
var redis = require('redis');
var fs = require('fs');
var path = require('path');

var scriptSha = null;

var DEFAULT_EXPIRY = 60; // 60s default expiry
var DEFAULT_LIMIT = 100; // 100 calls within the period

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

/**
 * Utility for creating functions from options
 */
function createConfigFunction(options, name, defaultValue) {
  var optionValue = options[name];
  if(typeof optionValue === 'function') {
    return optionValue;
  }

  if(!defaultValue) {
    throw new Error(name + ' required');
  }

  var value = name in options ? optionValue : defaultValue;

  return function() {
    return value;
  };

}

module.exports = function(options) {
  var redisClient;

  var prefix = options.prefix || '';
  var keyFn = createConfigFunction(options, 'keyFunction', DEFAULT_EXPIRY);
  var expiryFn = createConfigFunction(options, 'expiry', DEFAULT_EXPIRY);
  var limitFn = createConfigFunction(options, 'limit', DEFAULT_LIMIT);
  var applyLimitFn = createConfigFunction(options, 'applyLimit', true);

  // Redis client
  if(options.redisClient) {
    redisClient = options.redisClient;
  } else {
    var redisOptions = options.redis || {};

    redisClient = redis.createClient(redisOptions.port, redisOptions.host, redisOptions.options);
  }

  return function(req, res, next) {
    var applyLimit = applyLimitFn(req);
    if(!applyLimit) return next();

    var key = prefix + keyFn(req);
    var expiry = expiryFn(req);

    loadAndRunScript(key, expiry, redisClient, 3, function(err, result) {
      if(err) return next(err);

      var count = result[0];
      var ttl = result[1];

      var limit = limitFn(req);

      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', limit - count);
      res.setHeader('X-RateLimit-Reset', Date.now() + ttl * 1000);

      if(count > limit) {
        var e = new Error("API rate limit exceeded.");
        e.statusCode = 403;
        e.rateLimit = true;

        return next(e);
      }

      next();
    });
  };
};
