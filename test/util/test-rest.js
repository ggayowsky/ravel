'use strict';

const chai = require('chai');
// const expect = chai.expect;
chai.use(require('chai-things'));
chai.use(require('sinon-chai'));
// const sinon = require('sinon');
const mockery = require('mockery');
const request = require('supertest');
const koa = require('koa');
const httpCodes = require('../../lib/util/http_codes');

let Ravel, rest, app;

describe('util/rest', function() {
  beforeEach(function(done) {
    //enable mockery
    mockery.enable({
      useCleanCache: true,
      warnOnReplace: false,
      warnOnUnregistered: false
    });

    app = koa();
    Ravel = new (require('../../lib/ravel'))();
    Ravel.Log.setLevel('NONE');
    Ravel.kvstore = {}; //mock Ravel.kvstore, since we're not actually starting Ravel.

    rest = new (require('../../lib/util/rest'))(Ravel);
    done();
  });

  afterEach(function(done) {
    app = undefined;
    Ravel = undefined;
    rest = undefined;
    mockery.deregisterAll();mockery.disable();
    done();
  });

  describe('#respond()', function() {
    it('should produce a response with HTTP 204 NO CONTENT if no json payload is supplied', function (done) {
      app.use(rest.respond());
      request(app.callback())
      .get('/')
      .expect(204, '', done);
    });

    it('should produce a response with HTTP 200 OK containing a string body if a json payload is supplied', function (done) {
      const result = {};
      app.use(rest.respond());
      app.use(function*() {
        this.body = result;
      });
      request(app.callback())
      .get('/')
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(200, result, done);
    });

    it('should produce a response with HTTP 201 CREATED and an appropriate location header if a json body containing a property \'id\' is supplied along with an okCode of CREATED', function(done) {
      const result = {
        id:1
      };
      app.use(rest.respond());
      app.use(function*() {
        this.body = result;
      });

      request(app.callback())
      .post('/entity')
      .set('origin', 'http://localhost:8080/')
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect('Location', 'http://localhost:8080/entity/1')
      .expect(201, result, done);
    });

    it('should produce a response with HTTP 206 PARTIAL CONTENT if it is supplied as an okCode along with options.start, options.end and options.count', function(done) {
      const result = [];

      const options = {
        start: 0,
        end: 5,
        count: 10
      };

      app.use(rest.respond(httpCodes.PARTIAL_CONTENT, options));
      app.use(function*() {
        this.body = result;
      });

      request(app.callback())
      .get('/')
      .set('origin', 'http://localhost:8080/')
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect('Content-Range', `items ${options.start}-${options.end}/${options.count}`)
      .expect(206, result, done);
    });
  });

  describe('#errorHandler()', function() {
    it('should respond with HTTP 404 NOT FOUND when ApplicationError.NotFound is passed as err', function(done) {
      const message = 'a message';
      app.use(rest.errorHandler());
      app.use(function*() {
        throw new Ravel.ApplicationError.NotFound(message);
      });
      request(app.callback())
      .get('/')
      .expect(404, `NotFoundError: ${message}`, done);
    });

    it('should respond with HTTP 403 Forbidden when ApplicationError.Access is passed as err', function(done) {
      const message = 'a message';
      app.use(rest.errorHandler());
      app.use(function*() {
        throw new Ravel.ApplicationError.Access(message);
      });
      request(app.callback())
      .get('/')
      .expect(403, `AccessError: ${message}`, done);
    });

    it('should respond with HTTP 405 METHOD NOT ALLOWED when ApplicationError.NotAllowed is passed as err', function(done) {
      const message = 'a message';
      app.use(rest.errorHandler());
      app.use(function*() {
        throw new Ravel.ApplicationError.NotAllowed(message);
      });
      request(app.callback())
      .get('/')
      .expect(405, `NotAllowedError: ${message}`, done);
    });

    it('should respond with HTTP 501 NOT IMPLEMENTED when ApplicationError.NotImplemented is passed as err', function(done) {
      const message = 'a message';
      app.use(rest.errorHandler());
      app.use(function*() {
        throw new Ravel.ApplicationError.NotImplemented(message);
      });
      request(app.callback())
      .get('/')
      .expect(501, `NotImplementedError: ${message}`, done);
    });

    it('should respond with HTTP 409 CONFLICT when ApplicationError.DuplicateEntry is passed as err', function(done) {
      const message = 'a message';
      app.use(rest.errorHandler());
      app.use(function*() {
        throw new Ravel.ApplicationError.DuplicateEntry(message);
      });
      request(app.callback())
      .get('/')
      .expect(409, `DuplicateEntryError: ${message}`, done);
    });

    it('should respond with HTTP 416 REQUESTED_RANGE_NOT_SATISFIABLE when ApplicationError.RangeOutOfBounds is passed as err', function(done) {
      const message = 'a message';
      app.use(rest.errorHandler());
      app.use(function*() {
        throw new Ravel.ApplicationError.RangeOutOfBounds(message);
      });
      request(app.callback())
      .get('/')
      .expect(416, `RangeOutOfBoundsError: ${message}`, done);
    });

    it('should respond with HTTP 400 BAD REQUEST when ApplicationError.IllegalValue is passed as err', function(done) {
      const message = 'a message';
      app.use(rest.errorHandler());
      app.use(function*() {
        throw new Ravel.ApplicationError.IllegalValue(message);
      });
      request(app.callback())
      .get('/')
      .expect(400, `IllegalValueError: ${message}`, done);
    });

    it('should respond with HTTP 500 INTERNAL SERVER ERROR when an unknown Error type is passed as err', function(done) {
      const message = 'a message';
      app.use(rest.errorHandler());
      app.use(function*() {
        throw new Error(message);
      });
      request(app.callback())
      .get('/')
      .expect(500, `Error: ${message}`, done);
    });
  });
});
