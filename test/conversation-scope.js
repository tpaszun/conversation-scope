var expect    = require("chai").expect
var request = require('supertest')
var async = require("async")
const assert = require('assert')

describe("Conversation scope", function() {

    var app

    beforeEach(function () {
        app = require('./fixtures/app.js')()
    })

    it("persist data during one temporary conversation", function(done) {
        var agent = request.agent(app)
        agent.get('/').query({operations: JSON.stringify([
            {fn: 'put', args: {key: 'test', value: 'x001x'}},
            {fn: 'get', args: {key: 'test'}},
        ])}).expect('x001x', done)
    })

    it("can return cid of current conversation (temporary)", function(done) {
        var agent = request.agent(app)
        agent.get('/').query({operations: JSON.stringify([
            {fn: 'cidValue'},
        ])}).expect(function(res) {
            if (!res.text) throw new Error("missing response with cid" + JSON.stringify(res))
        }).end(done)
    })

    it("remove data from temporary conversations", function(done) {
        var agent = request.agent(app)
        async.waterfall([
            function(cb) {
                agent.get('/').query({operations: JSON.stringify([
                    {fn: 'put', args: {key: 'test', value: 'x002x'}},
                ])}).expect(200).end(cb)
            },
            function(prevRes, cb) {
                agent.get('/').query({operations: JSON.stringify([
                    {fn: 'get', args: {key: 'test'}},
                ])}).expect(function(res) {
                    if (res.text) throw new Error("data should be undefined")
                }).end(cb)
            },
        ], done)
    })

    it("can return cid of current conversation (long-running)", function(done) {
        var agent = request.agent(app)
        agent.get('/').query({operations: JSON.stringify([
            {fn: 'begin', args: {}},
            {fn: 'cidValue', args: {}},
        ])}).expect(function(res) {
            if (!res.text) throw new Error("missing response with cid")
        }).end(done)
    })

    it("persist data after promoting to long-running conversation", function(done) {
        var agent = request.agent(app)
        agent.get('/').query({operations: JSON.stringify([
            {fn: 'put', args: {key: 'test', value: 'x003x'}},
            {fn: 'begin', args: {}},
            {fn: 'get', args: {key: 'test'}},
        ])}).expect('x003x', done)
    })

    it("persist data in long-running conversation", function(done) {
        var agent = request.agent(app)
        var cid = undefined
        async.waterfall([
            function(cb) {
                agent.get('/').query({operations: JSON.stringify([
                    {fn: 'put', args: {key: 'test', value: 'x004x'}},
                    {fn: 'begin', args: {}},
                    {fn: 'put', args: {key: 'test2', value: 'x008x'}},
                    {fn: 'cidValue', args: {}},
                ])}).expect(200).end(cb)
            },
            function(prevRes, cb) {
                cid = prevRes.text
                agent.get('/?cid=' + cid).query({operations: JSON.stringify([
                    {fn: 'get', args: {key: 'test'}},
                ])}).expect('x004x', cb)
            },
            function(prevRes, cb) {
                agent.get('/?cid=' + cid).query({operations: JSON.stringify([
                    {fn: 'get', args: {key: 'test2'}},
                ])}).expect('x008x', cb)
            },
        ], done)
    })

    it('throw error after "promoting" already long-running conversation', function(done) {
        var agent = request.agent(app)
        agent.get('/').query({operations: JSON.stringify([
            {fn: 'begin', args: {}},
            {fn: 'begin', args: {}},
        ])}).expect(function(res) {
            if (res.status !== 500) throw new Error("there should be internal server error")
        }).end(done)
    })

    it("promote temporary conversation to long-running with 'begin({join: true})'", function(done) {
        var agent = request.agent(app)
        async.waterfall([
            function(cb) {
                agent.get('/').query({operations: JSON.stringify([
                    {fn: 'put', args: {key: 'test', value: 'x006x'}},
                    {fn: 'begin', args: {'join': true}},
                    {fn: 'cidValue', args: {}},
                ])}).expect(200).end(cb)
            },
            function(prevRes, cb) {
                var cid = prevRes.text
                agent.get('/?cid=' + cid).query({operations: JSON.stringify([
                    {fn: 'get', args: {key: 'test'}},
                ])}).expect('x006x', cb)
            },
        ], done)
    })

    it("do nothing with 'begin({join: true}) when conversation is already long-running'", function(done) {
        var agent = request.agent(app)
        async.waterfall([
            function(cb) {
                agent.get('/').query({operations: JSON.stringify([
                    {fn: 'put', args: {key: 'test', value: 'x007x'}},
                    {fn: 'begin', args: {}},
                    {fn: 'begin', args: {'join': true}},
                    {fn: 'cidValue', args: {}},
                ])}).expect(200).end(cb)
            },
            function(prevRes, cb) {
                var cid = prevRes.text
                agent.get('/?cid=' + cid).query({operations: JSON.stringify([
                    {fn: 'get', args: {key: 'test'}},
                ])}).expect('x007x', cb)
            },
        ], done)
    })

    it('throw error when creating nested conversation in temporary one', function(done) {
        var agent = request.agent(app)
        agent.get('/').query({operations: JSON.stringify([
            {fn: 'begin', args: {nested: true}},
        ])}).expect(function(res) {
            if (res.status !== 500) throw new Error("there should be internal server error")
        }).end(done)
    })

    it('proceed through conversation tree until data found', function(done) {
        var agent = request.agent(app)
        async.waterfall([
            function(cb) {
                agent.get('/').query({operations: JSON.stringify([
                    {fn: 'put', args: {key: 'test', value: 'x009x'}},
                    {fn: 'begin', args: {}},
                    {fn: 'cidValue', args: {}},
                ])}).expect(200).end(cb)
            },
            function(prevRes, cb) {
                var cid = prevRes.text
                agent.get('/?cid=' + cid).query({operations: JSON.stringify([
                    {fn: 'begin', args: {nested: true}},
                    {fn: 'cidValue', args: {}},
                ])}).end(cb)
            },
            function(prevRes, cb) {
                var cid = prevRes.text
                agent.get('/?cid=' + cid).query({operations: JSON.stringify([
                    {fn: 'get', args: {key: 'test'}},
                ])}).expect('x009x', cb)
            },
        ], done)
    })

    it("data in nested conversation doesn't override outter data, but shadow it", function(done) {
        var agent = request.agent(app)
        var firstCid = undefined
        async.waterfall([
            function(cb) {
                agent.get('/').query({operations: JSON.stringify([
                    {fn: 'begin', args: {}},
                    {fn: 'put', args: {key: 'test', value: 'x010x'}},
                    {fn: 'cidValue', args: {}},
                ])}).expect(200, cb)
            },
            function(prevRes, cb) {
                firstCid = prevRes.text
                agent.get('/?cid=' + firstCid).query({operations: JSON.stringify([
                    {fn: 'begin', args: {nested: true}},
                    {fn: 'put', args: {key: 'test', value: 'x011x'}},
                    {fn: 'cidValue', args: {}},
                ])}).end(cb)
            },
            function(prevRes, cb) {
                var cid = prevRes.text
                agent.get('/?cid=' + cid).query({operations: JSON.stringify([
                    {fn: 'get', args: {key: 'test'}},
                ])}).expect('x011x', cb)
            },
            function(prevRes, cb) {
                agent.get('/?cid=' + firstCid).query({operations: JSON.stringify([
                    {fn: 'get', args: {key: 'test'}},
                ])}).expect('x010x', cb)
            },
        ], done)
    })

    it('throw error if calling end() when there is no long-running conversation', function(done) {
        var agent = request.agent(app)
        agent.get('/').query({operations: JSON.stringify([
            {fn: 'end', args: {}},
        ])}).expect(function(res) {
            if (res.status !== 500) throw new Error("there should be internal server error")
        }).end(done)
    })

    it('pop conversation on end() and resume outer one', function(done) {
        var agent = request.agent(app)
        async.waterfall([
            function(cb) {
                agent.get('/').query({operations: JSON.stringify([
                    {fn: 'begin', args: {}},
                    {fn: 'put', args: {key: 'test', value: 'x012x'}},
                    {fn: 'cidValue', args: {}},
                ])}).expect(200, cb)
            },
            function(prevRes, cb) {
                var cid = prevRes.text
                agent.get('/?cid=' + cid).query({operations: JSON.stringify([
                    {fn: 'begin', args: {nested: true}},
                    {fn: 'put', args: {key: 'test', value: 'x013x'}},
                    {fn: 'cidValue', args: {}},
                ])}).end(cb)
            },
            function(prevRes, cb) {
                var cid = prevRes.text
                agent.get('/?cid=' + cid).query({operations: JSON.stringify([
                    {fn: 'end', args: {}},
                    {fn: 'get', args: {key: 'test'}},
                ])}).expect('x012x', cb)
            },
        ], done)
    })

    it('destroy all descendant conversations with end()', function(done) {
        var agent = request.agent(app)
        var cids = []
        async.waterfall([
            function(cb) {
                agent.get('/').query({operations: JSON.stringify([
                    {fn: 'begin', args: {}},
                    {fn: 'put', args: {key: 'test', value: 'x014x'}},
                    {fn: 'cidValue', args: {}},
                ])}).expect(200, cb)
            },
            function(prevRes, cb) {
                cids.push(prevRes.text)
                agent.get('/?cid=' + cids[0]).query({operations: JSON.stringify([
                    {fn: 'begin', args: {nested: true}},
                    {fn: 'put', args: {key: 'test', value: 'x015x'}},
                    {fn: 'cidValue', args: {}},
                ])}).end(cb)
            },
            function(prevRes, cb) {
                cids.push(prevRes.text)
                agent.get('/?cid=' + cids[1]).query({operations: JSON.stringify([
                    {fn: 'begin', args: {nested: true}},
                    {fn: 'put', args: {key: 'test', value: 'x016x'}},
                    {fn: 'cidValue', args: {}},
                ])}).end(cb)
            },
            function(prevRes, cb) {
                cids.push(prevRes.text)
                agent.get('/?cid=' + cids[1]).query({operations: JSON.stringify([
                    {fn: 'end', args: {}},
                ])}).expect(200, cb)
            },
            function(prevRes, cb) {
                agent.get('/?cid=' + cids[0]).query({operations: JSON.stringify([
                    {fn: 'get', args: {key: 'test'}},
                ])}).expect('x014x', cb)
            },
            function(prevRes, cb) {
                agent.get('/?cid=' + cids[1]).query({operations: JSON.stringify([
                    {fn: 'get', args: {key: 'test'}},
                ])}).expect(500, cb)
            },
            function(prevRes, cb) {
                agent.get('/?cid=' + cids[2]).query({operations: JSON.stringify([
                    {fn: 'get', args: {key: 'test'}},
                ])}).expect(500, cb)
            },
        ], done)
    })

    it('destroy whole tree on end({root: true})', function(done) {
        var agent = request.agent(app)
        var cids = []
        async.waterfall([
            function(cb) {
                agent.get('/').query({operations: JSON.stringify([
                    {fn: 'begin', args: {}},
                    {fn: 'put', args: {key: 'test', value: 'x017x'}},
                    {fn: 'cidValue', args: {}},
                ])}).expect(200, cb)
            },
            function(prevRes, cb) {
                cids.push(prevRes.text)
                agent.get('/?cid=' + cids[0]).query({operations: JSON.stringify([
                    {fn: 'begin', args: {nested: true}},
                    {fn: 'put', args: {key: 'test', value: 'x018x'}},
                    {fn: 'cidValue', args: {}},
                ])}).end(cb)
            },
            function(prevRes, cb) {
                cids.push(prevRes.text)
                agent.get('/?cid=' + cids[1]).query({operations: JSON.stringify([
                    {fn: 'begin', args: {nested: true}},
                    {fn: 'put', args: {key: 'test', value: 'x019x'}},
                    {fn: 'cidValue', args: {}},
                ])}).end(cb)
            },
            function(prevRes, cb) {
                cids.push(prevRes.text)
                agent.get('/?cid=' + cids[1]).query({operations: JSON.stringify([
                    {fn: 'end', args: {root: true}},
                ])}).expect(200, cb)
            },
            function(prevRes, cb) {
                agent.get('/?cid=' + cids[0]).query({operations: JSON.stringify([
                    {fn: 'get', args: {key: 'test'}},
                ])}).expect(500, cb)
            },
            function(prevRes, cb) {
                agent.get('/?cid=' + cids[1]).query({operations: JSON.stringify([
                    {fn: 'get', args: {key: 'test'}},
                ])}).expect(500, cb)
            },
            function(prevRes, cb) {
                agent.get('/?cid=' + cids[2]).query({operations: JSON.stringify([
                    {fn: 'get', args: {key: 'test'}},
                ])}).expect(500, cb)
            },
        ], done)
    })
})
