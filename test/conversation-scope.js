var expect    = require("chai").expect
var ConversationScope = require("../index.js")
var request = require('supertest')

describe("Conversation scope", function() {
    var app;
    beforeEach(function () {
        app = require('./fixtures/app.js')();
        app.use(function (req, res, next) {
            ConversationScope.init(req, res, next);
        });
    });
    describe("add cid generator ", function() {
        it("returns random cid", function(done) {
            app.get('/', function (req, res, next) {
                var cid = req.session.generateCid()
                res.send(cid)
            })
            request(app).get('/').end(function(err, res) {
                if (res.length > 0) throw new Error("missing response cid")
                request(app).get('/').end(function(err2, res2) {
                    if (res2.length > 0) throw new Error("missing response cid");
                    if (res === res2) throw new Error("cid's are not unique");
                    done();
                })
            })
        })
    })
    describe("manage data between contexts", function() {
        it("access same data when there is no cid", function(done) {
            app.use(function (req, res, next) {
                req.session.begin();
                req.session.put('views', (req.session.get('views') || 0) + 1)
                next()
            })
            app.get('/', function (req, res, next) {
                var views = req.session.get('views')
                res.send(String(views))
            })
            var agent = request.agent(app);
            agent.get('/').expect("1").end(function(err, res) {
                if (err) return done(err);
                agent.get('/').expect("2").end(done)
            })
        })
        it("access same data when there is same cid", function(done) {
            app.use(function (req, res, next) {
                req.session.begin();
                req.session.put('views', (req.session.get('views') || 0) + 1)
                next()
            })
            app.get('/', function (req, res, next) {
                var views = req.session.get('views')
                res.send(String(views))
            })
            var agent = request.agent(app);
            var cid = '0abc123def0';
            agent.get('/?cid=' + cid).expect("1").end(function(err, res) {
                if (err) return done(err);
                agent.get('/?cid=' + cid).expect("2").end(done)
            })
        })
        it("not access data from another context", function(done) {
            app.use(function (req, res, next) {
                req.session.begin();
                req.session.put('views', (req.session.get('views') || 0) + 1)
                next()
            })
            app.get('/', function (req, res, next) {
                var views = req.session.get('views')
                res.send(String(views))
            })
            var agent = request.agent(app);
            var cid = '0abc123def0';
            agent.get('/?cid=' + cid).expect("1").end(function(err, res) {
                if (err) return done(err);
                agent.get('/').expect("1").end(done)
            })
        })
    });
});
});
