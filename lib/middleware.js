/*jshint node:true, unused:true */
"use strict";

var rateLimiter = require('./rate-limiter');

var DEFAULT_EXPIRY = 60; // 60s default expiry
var DEFAULT_LIMIT = 100; // 100 calls within the period

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
  var keyFn = createConfigFunction(options, 'keyFunction', DEFAULT_EXPIRY);
  var expiryFn = createConfigFunction(options, 'expiry', DEFAULT_EXPIRY);
  var limitFn = createConfigFunction(options, 'limit', DEFAULT_LIMIT);
  var applyLimitFn = createConfigFunction(options, 'applyLimit', true);

  var limiter = rateLimiter(options);

  return function(req, res, next) {
    var applyLimit = applyLimitFn(req);
    if(!applyLimit) return next();

    var key = keyFn(req);
    var expiry = expiryFn(req);

    limiter(key, expiry, function(err, count, ttl) {
      if(err) return next(err);

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
