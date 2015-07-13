
var assert = require("assert");

var dolph = require('..');

function makeResponse() {
  return {
    headers: {},
    setHeader: function(name, value) {
      this.headers[name] = value;
    }
  };
}

describe('dolph', function() {
  it('should allow a single call', function(done) {
    var now = Date.now();

    var middleware = dolph({
      prefix: 'dolphtest:',
      keyFunction: function() { return "x" + now; }
    });

    var response = makeResponse();
    middleware({}, response, function(err) {
      if(err) return done(err);

      assert.equal(response.headers['X-RateLimit-Limit'], 100);
      assert.equal(response.headers['X-RateLimit-Remaining'], 99);
      assert(response.headers['X-RateLimit-Reset'] > Date.now() + 50000);

      done();
    });

  });

  it('should not apply limits when the applyLimit function returns false', function(done) {
    var now = Date.now();

    var middleware = dolph({
      prefix: 'dolphtest:',
      applyLimit: function() { return false; },
      keyFunction: function() { assert(false); }
    });

    var response = makeResponse();
    middleware({}, response, function(err) {
      if(err) return done(err);

      done();
    });

  });


  it('the remaining count should go down as expected', function(done) {
    var now = Date.now();

    var middleware = dolph({
      prefix: 'dolphtest:',
      keyFunction: function() { return "ab" + now; }
    });

    var response = makeResponse();
    middleware({}, response, function(err) {
      if(err) return done(err);

      assert.equal(response.headers['X-RateLimit-Limit'], 100);
      assert.equal(response.headers['X-RateLimit-Remaining'], 99);
      assert(response.headers['X-RateLimit-Reset'] > Date.now() + 50000);

      var originalReset = response.headers['X-RateLimit-Reset'];

      response = makeResponse();
      middleware({}, response, function(err) {
        if(err) return done(err);

        assert.equal(response.headers['X-RateLimit-Limit'], 100);
        assert.equal(response.headers['X-RateLimit-Remaining'], 98);
        assert(originalReset - 40 < response.headers['X-RateLimit-Reset']);
        assert(originalReset + 40 > response.headers['X-RateLimit-Reset']);

        done();

      });

    });

  });

  it('the middleware should throw a 429 when the limit is reached', function(done) {
    var now = Date.now();

    var middleware = dolph({
      prefix: 'dolphtest:',
      keyFunction: function() { return "ab" + now; },
      limit: 1
    });

    var response = makeResponse();
    middleware({}, response, function(err) {
      if(err) return done(err);

      assert.equal(response.headers['X-RateLimit-Limit'], 1);
      assert.equal(response.headers['X-RateLimit-Remaining'], 0);

      response = makeResponse();
      middleware({}, response, function(err) {
        assert(err);
        assert.equal(err.status, 429);
        assert.equal(err.statusCode, 429);
        assert(err.rateLimit);

        done();
      });

    });

  });

  it('the middleware should reset after the ttl', function(done) {
    var now = Date.now();

    var middleware = dolph({
      prefix: 'dolphtest:',
      keyFunction: function() { return "ab" + now; },
      limit: 1,
      expiry: 1
    });

    var response = makeResponse();
    middleware({}, response, function(err) {
      if(err) return done(err);

      assert.equal(response.headers['X-RateLimit-Limit'], 1);
      assert.equal(response.headers['X-RateLimit-Remaining'], 0);
      assert(response.headers['X-RateLimit-Reset'] > Date.now() + 500);

      setTimeout(function() {
        response = makeResponse();
        middleware({}, response, function(err) {
          if(err) return done(err);

          assert.equal(response.headers['X-RateLimit-Limit'], 1);
          assert.equal(response.headers['X-RateLimit-Remaining'], 0);
          assert(response.headers['X-RateLimit-Reset'] > Date.now() + 500);

          done();
        });
      }, 1100);


    });

  });

  it('should allow 100 calls and the 101st should be limited', function(done) {
    var now = Date.now();

    var middleware = dolph({
      prefix: 'dolphtest:',
      keyFunction: function() { return "x" + now; }
    });

    var count = 0;
    var start = Date.now();
    var resetTime;

    (function nextIteration() {
      count++;
      if (count === 102) return done();

      var response = makeResponse();
      middleware({}, response, function(err) {
        if (count === 101) {
          assert(err);
          assert.equal(err.status, 429);
          assert.equal(err.statusCode, 429);
          assert(err.rateLimit);
        } else {
          assert(!err);
        }

        if (count === 1) {
          resetTime = response.headers['X-RateLimit-Reset'];
        } else {
          assert(resetTime >= response.headers['X-RateLimit-Reset'] - 1000);
          assert(resetTime < response.headers['X-RateLimit-Reset'] + 1000);
        }

        assert.equal(response.headers['X-RateLimit-Limit'], 100);
        assert.equal(response.headers['X-RateLimit-Remaining'], Math.max(0, 100 - count));

        nextIteration();
      });

    })();

  });

});
