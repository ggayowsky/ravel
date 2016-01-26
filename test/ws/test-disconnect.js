'use strict';

const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-things'));
chai.use(require('sinon-chai'));
const sinon = require('sinon');
const mockery = require('mockery');

let Mocks;

describe('ws/disconnect', function() {
  beforeEach(function(done) {    
    //enable mockery
    mockery.enable({
      useCleanCache: true,
      warnOnReplace: false,
      warnOnUnregistered: false
    });
    require('./before-each')(mockery, function(M) {
      Mocks = M;
      done();
    });
  });

  afterEach(function(done) {
    mockery.deregisterAll();mockery.disable();
    done();
  });

  describe('primus.on(\'disconnect\')', function() {
    it('should remove a user from all their subscribed rooms when they disconnect from primus', function(done) {
      Mocks.spark.userId = 1;
      sinon.stub(Mocks.Ravel.kvstore, 'sismember', function() {
        return true;
      });
      const rooms = ['/test/1', '/test/2'];
      const getRoomsSpy = sinon.stub(Mocks.Ravel.kvstore, 'smembers', function(key, callback) {
        callback(null, rooms);
      });
      const sremSpy = sinon.stub(Mocks.Ravel.kvstore, 'srem');
      const delSpy = sinon.stub(Mocks.Ravel.kvstore, 'del');
      const broadcastSpy = sinon.spy(Mocks.broadcast, 'emit');
      require('../../lib/ws/primus_init')(
        Mocks.Ravel, Mocks.Ravel._injector, Mocks.primus, Mocks.expressSessionStore, Mocks.roomResolver);
      Mocks.primus.emit('disconnection', Mocks.spark);
      expect(getRoomsSpy).to.have.been.calledWith('ws_user:1');
      expect(sremSpy).to.have.been.calledWith('ws_room:/test/1', 1);
      expect(broadcastSpy).to.have.been.calledWithMatch(
        '/test/1', 'user disconnected', {userId:1}, true);
      expect(sremSpy).to.have.been.calledWith('ws_room:/test/1', 1);
      expect(broadcastSpy).to.have.been.calledWithMatch(
        '/test/1', 'user disconnected', {userId:1}, true);
      expect(delSpy).to.have.been.calledWith('ws_user:1');
      done();
    });
  });
});
