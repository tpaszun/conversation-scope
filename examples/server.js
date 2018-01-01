var ConversationScope = require('../index.js');
var express = require('express')
var NodeSession = require('node-session');
var path = require('path');

var session = new NodeSession({secret: 'Q3UBzdH9GEfiRCTKbi5MTPyChpzXLsTD'});
var app = express()

app.set('views', path.join(__dirname, './views'));
app.set('view engine', 'ejs');

app.use(function (req, res, next) {
    session.startSession(req, res, next);
});

app.use(function (req, res, next) {
    ConversationScope.preprocess(req, res, next)
    res.on('finish', ConversationScope.postprocess);
});

app.get('/begin', function (req, res, next) {
    req.cs.begin()
    var cid = req.cs.cidValue()
    res.redirect('/?cid=' + cid)
})

app.use(function (req, res, next) {
    req.cs.put('views', (req.cs.get('views') || 0) + 1)
    next()
})

app.get('/', function (req, res, next) {
    res.render('index', {
        number_views: req.cs.get('views'),
        cid: req.cs.cidValue()
    });
})

app.listen(3000, () => console.log('Example app listening on port 3000!\n'))
