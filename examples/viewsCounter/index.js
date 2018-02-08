var ConversationScope = require('../../index.js');
var express = require('express');
var NodeSession = require('node-session');
var path = require('path');

var conversationSessionStore = require('../../conversationSessionStore');

var session = new NodeSession({secret: 'Q3UBzdH9GEfiRCTKbi5MTPyChpzXLsTD'});
var app = express();

app.set('views', path.join(__dirname, './views'));
app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));

app.use(function (req, res, next) {
    session.startSession(req, res, next);
});

app.use(function (req, res, next) {
    new ConversationScope(req, res, conversationSessionStore(req));

    next();
});

// proxy middleware
app.use(function (req, res, next) {
    var createHandler = require('../../proxyHandlers/NodeSession.js');
    req.session = new Proxy(req.session, createHandler(req.cs));
    next();
});

app.get('/begin', function (req, res, next) {
    req.cs.begin();
    var cid = req.cs.cidValue();
    res.redirect('/?cid=' + cid);
});

app.use(function (req, res, next) {
    req.session.put('views', (req.session.get('views') || 0) + 1);
    next();
});

app.get('/', function (req, res, next) {
    res.render('index', {
        number_views: req.session.get('views'),
        cid: req.cs.cidValue()
    });
});

app.listen(4000, () => console.log('Example app listening on port 4000!\n'));
