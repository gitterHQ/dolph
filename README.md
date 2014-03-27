# Dolph

Dolph is a rate-limiter middleware for Express.js.

### Naming

Dolph is named in honour of Dolph Lundgren, the actor who once worked as a nightclub bouncer and who reportedly has a genius level IQ and can speak 5 languages. An intelligent, sophisticated bouncer is exactly what Dolph the middleware aspires to be.

![dolph will crush you](http://i.imgur.com/GyYaUge.png?1?1668)

### Why yet another rate-limiter middleware?

Several similar middlewares already exist. At the time we evaluated the existing ones, none supported Redis-Lua scripting. We specifically wanted a solution that used redis lua scripting as it allows for an extremely simply, yet bug-free solution.

The basis of the rate limiting algorithm is documented at [redis.io](http://redis.io/commands/INCR).

### Installing dolph

```bash
$ npm install dolph --save
```

### Using dolph

Attach the middleware to the route you would like to rate limit.

```javascript
var dolph = require('dolph');

var rateLimiter = dolph({
   prefix: 'rate:',
   keyFunction: function() {
     return req.user.id;
   }
 });

app.get('/api/',
  rateLimiter,
  function(req, res) {
    // .. your code goes here
  });
```

### Options

Dolph will take an options hash. The options are:

 * `prefix`: the Redis key prefix to use
 * `keyFunction`: a function which will map a request into a string. The string should map a single entity which you would like to apply the limiter to. Using a userId is a good option if the limit is per user. Use a clientId if you will limit by clients. If it's a combination, concatenate the values into a single string. The function should take the form `function(req) { }`.
 * `expiry`: a time in seconds before the rate limit is reset. Can be a function with the form `function(req) { }`. Defaults to 60 seconds.
 * `limit`: the number of calls that can occur within the limit (as set by the expiry). Can be a function with the form `function(req) { }`. Defaults to 100.


### Information

Written by [@suprememoocow](https://twitter.com/suprememoocow) for [Gitter](https://gitter.im).



