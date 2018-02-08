var expect    = require("chai").expect;
var request = require('supertest');
var async = require("async");
const assert = require('assert');

describe("Conversation scope", function() {

    var app, agent;

    beforeEach(function () {
        app = require('./fixtures/app.js')();
        agent = request.agent(app);
    });

    function makeRequest(cid, data, method = 'GET') {
        var url = '/';
        data = data.join('|');
        var req = null;
        if (method == 'GET') {
            data = {operations: data};
            if (cid) {
                data.cid = cid;
            }
            req = agent.get(url).query(data);
        } else if (method == 'POST') {
            if (cid) {
                url = url + '?cid=' + cid;
            }
            req = agent.post(url).send({operations: data});
        } else {
            throw new Error('Unknown method');
        }
        return req;
    }

    it("persist data during one temporary conversation", function(done) {
        makeRequest(null, [
            "put;test;x001x",
            "get;test",
        ]).expect('x001x', done);
    });

    it("can return cid of current conversation (temporary)", function(done) {
        makeRequest(null, [
            "cidValue",
        ]).expect(function(res) {
            if (!res.text) throw new Error("missing response with cid" + JSON.stringify(res));
        }).end(done);
    });

    it("remove data from temporary conversations", function(done) {
        async.waterfall([
            function(cb) {
                makeRequest(null, [
                    "put;test;x002x",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                makeRequest(null, [
                    "get;test",
                ]).expect(function(res) {
                    if (res.text) throw new Error("data should be undefined");
                }).end(cb);
            },
        ], done);
    });

    it("can return cid of current conversation (long-running)", function(done) {
        makeRequest(null, [
            "begin",
            "cidValue",
        ]).expect(function(res) {
            if (!res.text) throw new Error("missing response with cid");
        }).end(done);
    });

    it("persist data after promoting to long-running conversation", function(done) {
        makeRequest(null, [
            "put;test;x003x",
            "begin",
            "get;test",
        ]).expect('x003x', done);
    });

    it("persist data in long-running conversation", function(done) {
        var cid;
        async.waterfall([
            function(cb) {
                makeRequest(null, [
                    "put;test;x004x",
                    "begin",
                    "put;test2;x008x",
                    "cidValue",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                cid = prevRes.text;
                makeRequest(cid, [
                    "get;test",
                ]).expect('x004x', cb);
            },
            function(prevRes, cb) {
                makeRequest(cid, [
                    "get;test2",
                ]).expect('x008x', cb);
            },
        ], done);
    });

    it('throw error after "promoting" already long-running conversation', function(done) {
        makeRequest(null, [
            "begin",
            "begin",
        ]).expect(function(res) {
            if (res.status !== 500) throw new Error("there should be internal server error");
        }).end(done);
    });

    it("promote temporary conversation to long-running with 'begin({join: true})'", function(done) {
        async.waterfall([
            function(cb) {
                makeRequest(null, [
                    "put;test;x006x",
                    "begin;join=true",
                    "cidValue",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                var cid = prevRes.text;
                makeRequest(cid, [
                    "get;test",
                ]).expect('x006x', cb);
            },
        ], done);
    });

    it("do nothing with 'begin({join: true}) when conversation is already long-running'", function(done) {
        async.waterfall([
            function(cb) {
                makeRequest(null, [
                    "put;test;x007x",
                    "begin",
                    "begin;join=true",
                    "cidValue",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                var cid = prevRes.text;
                makeRequest(cid, [
                    "get;test",
                ]).expect('x007x', cb);
            },
        ], done);
    });

    it('throw error when creating nested conversation in temporary one', function(done) {
        makeRequest(null, [
            "begin;nested=true",
        ]).expect(function(res) {
            if (res.status !== 500) throw new Error("there should be internal server error");
        }).end(done);
    });

    it('proceed through conversation tree until data found', function(done) {
        async.waterfall([
            function(cb) {
                makeRequest(null, [
                    "put;test;x009x",
                    "begin",
                    "cidValue",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                var cid = prevRes.text;
                makeRequest(cid, [
                    "begin;nested=true",
                    "cidValue",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                var cid = prevRes.text;
                makeRequest(cid, [
                    "get;test",
                ]).expect('x009x', cb);
            },
        ], done);
    });

    it("data in nested conversation doesn't override outter data, but shadow it", function(done) {
        var firstCid;
        async.waterfall([
            function(cb) {
                makeRequest(null, [
                    "begin",
                    "put;test;x010x",
                    "cidValue",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                firstCid = prevRes.text;
                makeRequest(firstCid, [
                    "begin;nested=true",
                    "put;test;x011x",
                    "cidValue",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                var cid = prevRes.text;
                makeRequest(cid, [
                    "get;test",
                ]).expect('x011x', cb);
            },
            function(prevRes, cb) {
                makeRequest(firstCid, [
                    "get;test",
                ]).expect('x010x', cb);
            },
        ], done);
    });

    it('throw error if calling end() when there is no long-running conversation', function(done) {
        makeRequest(null, [
            "end",
        ]).expect(function(res) {
            if (res.status !== 500) throw new Error("there should be internal server error");
        }).end(done);
    });

    it('pop conversation on end() and resume outer one', function(done) {
        async.waterfall([
            function(cb) {
                makeRequest(null, [
                    "begin",
                    "put;test;x012x",
                    "cidValue",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                var cid = prevRes.text;
                makeRequest(cid, [
                    "begin;nested=true",
                    "put;test;x013x",
                    "cidValue",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                var cid = prevRes.text;
                makeRequest(cid, [
                    "end",
                    "get;test;x013x",
                ]).expect('x012x', cb);
            },
        ], done);
    });

    it('destroy all descendant conversations with end()', function(done) {
        var cids = [];
        async.waterfall([
            function(cb) {
                makeRequest(null, [
                    "begin",
                    "put;test;x014x",
                    "cidValue",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                cids.push(prevRes.text);
                makeRequest(cids[0], [
                    "begin;nested=true",
                    "put;test;x015x",
                    "cidValue",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                cids.push(prevRes.text);
                makeRequest(cids[1], [
                    "begin;nested=true",
                    "put;test;x016x",
                    "cidValue",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                cids.push(prevRes.text);
                makeRequest(cids[1], [
                    "end",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                makeRequest(cids[0], [
                    "get;test",
                ]).expect('x014x', cb);
            },
            function(prevRes, cb) {
                makeRequest(cids[1], [
                    "get;test",
                ]).expect('', cb);
            },
            function(prevRes, cb) {
                makeRequest(cids[2], [
                    "get;test",
                ]).expect('', cb);
            },
        ], done);
    });

    it('destroy whole tree on end({root: true})', function(done) {
        var agent = request.agent(app);
        var cids = [];
        async.waterfall([
            function(cb) {
                makeRequest(null, [
                    "begin",
                    "put;test;x017x",
                    "cidValue",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                cids.push(prevRes.text);
                makeRequest(cids[0], [
                    "begin;nested=true",
                    "put;test;x018x",
                    "cidValue",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                cids.push(prevRes.text);
                makeRequest(cids[1], [
                    "begin;nested=true",
                    "put;test;x019x",
                    "cidValue",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                cids.push(prevRes.text);
                makeRequest(cids[1], [
                    "end;root=true",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                makeRequest(cids[0], [
                    "get;test",
                ]).expect('', cb);
            },
            function(prevRes, cb) {
                makeRequest(cids[1], [
                    "get;test",
                ]).expect('', cb);
            },
            function(prevRes, cb) {
                makeRequest(cids[2], [
                    "get;test",
                ]).expect('', cb);
            },
        ], done);
    });

    it('skip non-existing cid', function(done) {
        var non_existing_cid = 'c23423';
        async.waterfall([
            function(cb) {
                makeRequest(non_existing_cid, [
                    "begin",
                    "put;test;x030x",
                    "cidValue",
                ]).expect(200, cb);
            },
            function(prevRes, cb) {
                var cid = prevRes.text;
                makeRequest(cid, [
                    "get;test",
                ]).expect('x030x', cb);
            },
            function(prevRes, cb) {
                makeRequest(non_existing_cid, [
                    "get;test",
                ]).expect('', cb);
            },
        ], done);
    });
});
