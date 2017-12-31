var expect    = require("chai").expect
var ConversationScope = require("../index.js")
var request = require('supertest')
var async = require("async")
const assert = require('assert')

describe("Conversation scope", function() {

    var app

    beforeEach(function () {
        app = require('./fixtures/app.js')()
        app.use(function (req, res, next) {
            ConversationScope.preprocess(req, res, next)
            res.on('finish', ConversationScope.postprocess);
        })
    })

    it("persist data during one temporary conversation", function(done) {
        app.get('/req1', function (req, res, next) {
            var value = req.query.value
            req.cs.put('test', 'x001x')
            var retrievedValue = req.cs.get('test')
            res.send(retrievedValue)
        })
        var agent = request.agent(app)
        agent.get('/req1').expect('x001x', done)
    })

    it("can return cid of current conversation (temporary)", function(done) {
        app.get('/req1', function (req, res, next) {
            var cid = req.cs.cidValue()
            res.send(cid)
        })
        var agent = request.agent(app)
        agent.get('/req1').expect(function(res) {
            if (!res.text) throw new Error("missing response with cid")
        }).end(done)
    })

    it("remove data from temporary conversations", function(done) {
        app.get('/req1', function (req, res, next) {
            req.cs.put('test', 'x002x')
            res.sendStatus(200)
        })
        app.get('/req2', function (req, res, next) {
            var retrievedValue = req.cs.get('test')
            res.send(retrievedValue)
        })
        var agent = request.agent(app)
        async.waterfall([
            function(cb) {
                agent.get('/req1').expect(200).end(cb)
            },
            function(prevRes, cb) {
                agent.get('/req2').expect(function(res) {
                    if (res.text) throw new Error("data should be undefined")
                }).end(cb)
            },
        ], done)
    })

    it("can return cid of current conversation (long-running)", function(done) {
        app.get('/req1', function (req, res, next) {
            req.cs.begin()
            var cid = req.cs.cidValue()
            res.send(cid)
        })
        var agent = request.agent(app)
        agent.get('/req1').expect(function(res) {
            if (!res.text) throw new Error("missing response with cid")
        }).end(done)
    })

    it("persist data after promoting to long-running conversation", function(done) {
        app.get('/req1', function (req, res, next) {
            req.cs.put('test', 'x003x')
            req.cs.begin()
            var retrievedValue = req.cs.get('test')
            res.send(retrievedValue)
        })
        var agent = request.agent(app)
        agent.get('/req1').expect('x003x', done)
    })

    it("persist data in long-running conversation", function(done) {
        app.get('/req1', function (req, res, next) {
            req.cs.put('test', 'x004x')
            req.cs.begin()
            req.cs.put('test2', 'x008x')
            var cid = req.cs.cidValue()
            res.send(cid)
        })
        app.get('/req2', function (req, res, next) {
            var retrievedValue = req.cs.get('test')
            res.send(retrievedValue)
        })
        app.get('/req3', function (req, res, next) {
            var retrievedValue = req.cs.get('test2')
            res.send(retrievedValue)
        })
        var agent = request.agent(app)
        var cid = undefined
        async.waterfall([
            function(cb) {
                agent.get('/req1').expect(200).end(cb)
            },
            function(prevRes, cb) {
                cid = prevRes.text
                agent.get('/req2?cid=' + cid).expect('x004x', cb)
            },
            function(prevRes, cb) {
                agent.get('/req3?cid=' + cid).expect('x008x', cb)
            },
        ], done)
    })

    it('throw error after "promoting" already long-running conversation', function(done) {
        app.get('/req1', function (req, res, next) {
            req.cs.begin()
            try {
                req.cs.begin()
            } catch (e) {
                res.sendStatus(500)
                return
            }
            res.sendStatus(200)
        })
        var agent = request.agent(app)
        agent.get('/req1').expect(function(res) {
            if (res.status !== 500) throw new Error("there should be internal server error")
        }).end(done)
    })

    it("promote temporary conversation to long-running with 'begin({join: true})'", function(done) {
        app.get('/req1', function (req, res, next) {
            req.cs.put('test', 'x006x')
            req.cs.begin({join: true})
            var cid = req.cs.cidValue()
            res.send(cid)
        })
        app.get('/req2', function (req, res, next) {
            var retrievedValue = req.cs.get('test')
            res.send(retrievedValue)
        })
        var agent = request.agent(app)
        async.waterfall([
            function(cb) {
                agent.get('/req1').expect(200).end(cb)
            },
            function(prevRes, cb) {
                var cid = prevRes.text
                agent.get('/req2?cid=' + cid).expect('x006x', cb)
            },
        ], done)
    })

    it("do nothing with 'begin({join: true}) when conversation is already long-running'", function(done) {
        app.get('/req1', function (req, res, next) {
            req.cs.put('test', 'x007x')
            req.cs.begin()
            req.cs.begin({join: true})
            var cid = req.cs.cidValue()
            res.send(cid)
        })
        app.get('/req2', function (req, res, next) {
            var retrievedValue = req.cs.get('test')
            res.send(retrievedValue)
        })
        var agent = request.agent(app)
        async.waterfall([
            function(cb) {
                agent.get('/req1').expect(200).end(cb)
            },
            function(prevRes, cb) {
                var cid = prevRes.text
                agent.get('/req2?cid=' + cid).expect('x007x', cb)
            },
        ], done)
    })

    it('throw error when creating nested conversation in temporary one', function(done) {
        app.get('/req1', function (req, res, next) {
            try {
                req.cs.begin({nested: true})
            } catch (e) {
                res.sendStatus(500)
                return
            }
            res.sendStatus(200)
        })
        var agent = request.agent(app)
        agent.get('/req1').expect(function(res) {
            if (res.status !== 500) throw new Error("there should be internal server error")
        }).end(done)
    })

    it('proceed through conversation tree until data found', function(done) {
        app.get('/req1', function (req, res, next) {
            req.cs.put('test', 'x009x')
            req.cs.begin()
            var cid = req.cs.cidValue()
            res.send(cid)
        })
        app.get('/req2', function (req, res, next) {
            req.cs.begin({nested: true})
            var cid = req.cs.cidValue()
            res.send(cid)
        })
        app.get('/req3', function (req, res, next) {
            var retrievedValue = req.cs.get('test')
            res.send(retrievedValue)
        })
        var agent = request.agent(app)
        async.waterfall([
            function(cb) {
                agent.get('/req1').expect(200).end(cb)
            },
            function(prevRes, cb) {
                var cid = prevRes.text
                agent.get('/req2?cid=' + cid).end(cb)
            },
            function(prevRes, cb) {
                var cid = prevRes.text
                agent.get('/req3?cid=' + cid).expect('x009x', cb)
            },
        ], done)
    })

    it("data in nested conversation doesn't override outter data, but shadow it", function(done) {
        app.get('/req1', function (req, res, next) {
            req.cs.begin()
            req.cs.put('test', 'x010x')
            var cid = req.cs.cidValue()
            res.send(cid)
        })
        app.get('/req2', function (req, res, next) {
            req.cs.begin({nested: true})
            req.cs.put('test', 'x011x')
            var cid = req.cs.cidValue()
            res.send(cid)
        })
        app.get('/req3', function (req, res, next) {
            var retrievedValue = req.cs.get('test')
            res.send(retrievedValue)
        })
        var agent = request.agent(app)
        var firstCid = undefined
        async.waterfall([
            function(cb) {
                agent.get('/req1').expect(200, cb)
            },
            function(prevRes, cb) {
                firstCid = prevRes.text
                agent.get('/req2?cid=' + firstCid).end(cb)
            },
            function(prevRes, cb) {
                var cid = prevRes.text
                agent.get('/req3?cid=' + cid).expect('x011x', cb)
            },
            function(prevRes, cb) {
                agent.get('/req3?cid=' + firstCid).expect('x010x', cb)
            },
        ], done)
    })
})
