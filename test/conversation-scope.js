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
});
