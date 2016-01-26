'use strict';

const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-things'));
const mockery = require('mockery');
const sinon = require('sinon');

let Ravel, tokenAuth, profile, testProvider;

describe('auth/authorize_token', function() {
  beforeEach(function(done) {
    //enable mockery
    mockery.enable({
      useCleanCache: true,
      warnOnReplace: false,
      warnOnUnregistered: false
    });
    //mock Ravel.kvstore, since we're not actually starting Ravel.
    const redisMock = {
      createClient: function() {
        const redisClientStub = new (require('events').EventEmitter)();
        redisClientStub.auth = function(){};
        redisClientStub.get = function(){};
        redisClientStub.setex = function(){};
        return redisClientStub;
      },
    };
    mockery.registerMock('redis', redisMock);

    Ravel = new (require('../../lib/ravel'))();
    Ravel.Log.setLevel(Ravel.Log.NONE);
    Ravel.set('redis port', 0);
    Ravel.set('redis host', 'localhost');
    Ravel.set('redis password', 'password');
    Ravel.kvstore = require('../../lib/util/kvstore')(Ravel);

    tokenAuth = new require('../../lib/auth/authorize_token')(Ravel);

    //mock up an authorization provider for our tests
    profile = {};
    testProvider = new Ravel.AuthorizationProvider('test');
    testProvider.init = function() {
      //do nothing
    };
    testProvider.handlesClient = function(client) {
      return client === 'test-web';
    };
    testProvider.tokenToProfile = function(token, client, callback) {
      callback(null, profile, 2000);
    };
    const providers = Ravel.get('authorization providers');
    providers.push(testProvider);
    Ravel.set('authorization providers', providers);
    done();
  });

  afterEach(function(done) {
    Ravel = undefined;
    tokenAuth = undefined;
    mockery.deregisterAll();
    mockery.disable();
    done();
  });

  describe('#tokenToProfile()', function() {
    it('should use the appropriate authorization provider to validate and turn a client token into a profile', function(done) {
      sinon.stub(Ravel.kvstore, 'get', function(key, callback) {
        callback(null, undefined);
      });
      sinon.stub(Ravel.kvstore, 'setex');
      tokenAuth.tokenToProfile('oauth-token', 'test-web', function(err, result) {
        expect(err).to.be.null;
        expect(result).to.equal(profile);
        done();
      });
    });

    it('should throw a Ravel.ApplicationError.NotFound error if there is no provider for the given client type', function(done) {
      tokenAuth.tokenToProfile('oauth-token', 'test-ios', function(err, result) {
        expect(err).to.be.instanceof(Ravel.ApplicationError.NotFound);
        expect(result).to.be.not.ok;
        done();
      });
    });

    it('should cache profiles in redis using an expiry time which matches the token expiry time', function(done) {
      sinon.stub(Ravel.kvstore, 'get', function(key, callback) {
        callback(null, undefined);
      });
      const spy = sinon.stub(Ravel.kvstore, 'setex');
      tokenAuth.tokenToProfile('oauth-token', 'test-web', function(err, result) {
        expect(err).to.be.null;
        expect(result).to.equal(profile);
        expect(spy).to.have.been.calledWith(testProvider.name+'-test-web-profile-oauth-token', 2000, JSON.stringify(profile));
        done();
      });
    });

    it('should satisfy profile translates from redis when possible', function(done) {
      sinon.stub(Ravel.kvstore, 'get', function(key, callback) {
        callback(null, JSON.stringify(profile));
      });
      const setexSpy = sinon.stub(Ravel.kvstore, 'setex');
      const translateSpy = sinon.spy(testProvider, 'tokenToProfile');
      tokenAuth.tokenToProfile('oauth-token', 'test-web', function(err, result) {
        expect(err).to.be.null;
        expect(result).to.deep.equal(profile);
        expect(setexSpy).to.not.have.been.called;
        expect(translateSpy).to.not.have.been.called;
        done();
      });
    });

    it('should callback with an error if anything goes wrong while translating the token into a profile, such an encountering an invalid token', function(done) {
      sinon.stub(Ravel.kvstore, 'get', function(key, callback) {
        callback(null, undefined);
      });
      const spy = sinon.stub(Ravel.kvstore, 'setex');
      sinon.stub(testProvider, 'tokenToProfile', function(token, client, callback) {
        callback(new Error());
      });
      tokenAuth.tokenToProfile('oauth-token', 'test-web', function(err, result) {
        expect(err).to.be.not.null;
        expect(result).to.be.not.ok;
        expect(spy).to.not.have.been.called;
        done();
      });
    });
  });
});
