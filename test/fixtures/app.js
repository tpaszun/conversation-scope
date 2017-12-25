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

module.exports = app;
