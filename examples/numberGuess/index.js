var ConversationScope = require('../../index.js');
var express = require('express');
var NodeSession = require('node-session');
var path = require('path');

var conversationFileStore = require('../../conversationFileStore');

var users = require('./users');

var session = new NodeSession({secret: 'Q3UBzdH9GEfiRCTKbi5MTPyChpzXLsTD'});
var app = express();

app.set('views', path.join(__dirname, './views'));
app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));

app.use(function (req, res, next) {
    session.startSession(req, res, next);
});

app.use(function (req, res, next) {
    new ConversationScope(req, res, conversationFileStore);

    next();
});

app.get('/login', function(req, res, next) {
    res.render('login', {
        error: null,
        user: req.session.get('user')
    });
});

app.post('/login', function(req, res, next) {
    var userName = req.body.username;
    var userPassword = users[req.body.username];

    if (userPassword === undefined || userPassword != req.body.password) {
        res.render('login', {
            error: 'Bad username or password',
            user: req.session.get('user')
        });
        return;
    }
    req.session.put('user', userName);
    res.redirect('/');
});

app.get('/logout', function(req, res, next) {
    req.session.forget('user');
    res.redirect('/');
});

app.get('/', function (req, res, next) {
    req.cs.begin({join: true});
    var randomNumber = req.cs.get('randomNumber');
    var cidValue = req.cs.cidValue();
    var biggest = 50;
    var smallest = 1;
    if (randomNumber === undefined) {
        randomNumber = Math.floor((Math.random() * biggest) + smallest);
        req.cs.put('randomNumber', randomNumber);
        req.cs.put('biggest', 50);
        req.cs.put('smallest', 1);
        req.cs.put('maxGuesses', 10);
        req.cs.put('guessCount', 0);
        req.cs.put('cheated', false);
        console.log("[" + cidValue + "] Random number: " + randomNumber);
    }
    biggest = req.cs.get('biggest');
    smallest = req.cs.get('smallest');
    var maxGuesses = req.cs.get('maxGuesses');
    var guessCount = req.cs.get('guessCount');
    var currentGuess = req.cs.get('currentGuess');

    res.render('index', {
        randomNumber: randomNumber,
        currentGuess: currentGuess,
        smallest: smallest,
        biggest: biggest,
        remainingGuesses: (maxGuesses-guessCount),
        cidValue: cidValue,
        user: req.session.get('user')
    });
});

app.post('/guess', function (req, res, next) {
    var randomNumber = req.cs.get('randomNumber');
    var maxGuesses = req.cs.get('maxGuesses');
    var guessCount = req.cs.get('guessCount');
    var cidValue = req.cs.cidValue();

    var currentGuess = req.body.number;
    req.cs.put('currentGuess', currentGuess);
    console.log("[" + cidValue + "] guess: " + currentGuess);

    if (currentGuess == randomNumber) {
        var cheated = req.cs.get('cheated');
        req.cs.end();
        res.render('win', {
            randomNumber: randomNumber,
            guessCount: guessCount,
            cheated: cheated,
            user: req.session.get('user')
        });
        return;
    }

    guessCount = guessCount + 1;
    req.cs.put('guessCount', guessCount);

    if (guessCount >= maxGuesses) {
        req.cs.end();
        res.render('lose', {
            randomNumber: randomNumber,
            guessCount: guessCount,
            user: req.session.get('user')
        });
        return;
    }

    res.redirect('/?cid=' + cidValue);
});

app.get('/giveup', function (req, res, next) {
    var randomNumber = req.cs.get('randomNumber');
    req.cs.end();
    res.render('giveup', {
        randomNumber: randomNumber,
        user: req.session.get('user')
    });
});

app.get('/cheat', function (req, res, next) {
    req.cs.put('cheated', true);
    var randomNumber = req.cs.get('randomNumber');
    var cidValue = req.cs.cidValue();
    res.render('cheat', {
        randomNumber: randomNumber,
        cidValue: cidValue,
        user: req.session.get('user')
    });
});

app.listen(3000, () => console.log('Example app listening on port 3000!\n'));
