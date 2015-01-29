/*jshint node:true */
"use strict";

var middleware = require('./lib/middleware');
var rateLimiter = require('./lib/rate-limiter');

middleware.rateLimiter = rateLimiter;
module.exports = middleware;
