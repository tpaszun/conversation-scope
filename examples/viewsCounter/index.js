var ConversationScope = require('../../index.js');
var express = require('express')
var NodeSession = require('node-session');
var path = require('path');

var session = new NodeSession({secret: 'Q3UBzdH9GEfiRCTKbi5MTPyChpzXLsTD'});
var app = express()

app.set('views', path.join(__dirname, './views'));
app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));

app.use(function (req, res, next) {
    session.startSession(req, res, next);
});

app.use(function (req, res, next) {
    // it is important to copy reference, if you want to use proxy
    var sess = req.session
    var config = {
        getCallback: function(key) {
            return sess.get(key)
        },
        putCallback: function(key, value) {
            return sess.put(key, value)
        },
        excludedKeys: ['flash.old', 'flash.new']
    }
    ConversationScope.run(req, res, next, config)
})

// proxy middleware
app.use(function (req, res, next) {
    var createHandler = require('../../proxyHandlers/NodeSession.js')
    req.session = new Proxy(req.session, createHandler(req.cs))
    next()
});

app.get('/begin', function (req, res, next) {
    req.cs.begin()
    var cid = req.cs.cidValue()
    res.redirect('/?cid=' + cid)
})

app.use(function (req, res, next) {
    req.session.put('views', (req.session.get('views') || 0) + 1)
    next()
})

app.get('/', function (req, res, next) {
    res.render('index', {
        number_views: req.session.get('views'),
        cid: req.cs.cidValue()
    });
})

app.listen(3000, () => console.log('Example app listening on port 3000!\n'))
