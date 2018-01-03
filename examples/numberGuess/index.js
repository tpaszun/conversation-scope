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

app.get('/', function (req, res, next) {
    req.cs.begin({join: true})
    var randomNumber = req.cs.get('randomNumber')
    var cidValue = req.cs.cidValue()
    var biggest = 50
    var smallest = 1
    if (randomNumber === undefined) {
        randomNumber = Math.floor((Math.random() * biggest) + smallest)
        req.cs.put('randomNumber', randomNumber)
        req.cs.put('biggest', 50)
        req.cs.put('smallest', 1)
        req.cs.put('maxGuesses', 10)
        req.cs.put('guessCount', 0)
        req.cs.put('cheated', false)
        console.log("[" + cidValue + "] Random number: " + randomNumber)
    }
    biggest = req.cs.get('biggest')
    smallest = req.cs.get('smallest')
    var maxGuesses = req.cs.get('maxGuesses')
    var guessCount = req.cs.get('guessCount')
    var currentGuess = req.cs.get('currentGuess')

    res.render('index', {
        randomNumber: randomNumber,
        currentGuess: currentGuess,
        smallest: smallest,
        biggest: biggest,
        remainingGuesses: (maxGuesses-guessCount),
        cidValue: cidValue,
    });
})

app.post('/guess', function (req, res, next) {
    var randomNumber = req.cs.get('randomNumber')
    var maxGuesses = req.cs.get('maxGuesses')
    var guessCount = req.cs.get('guessCount')
    var cidValue = req.cs.cidValue()

    var currentGuess = req.body.number
    req.cs.put('currentGuess', currentGuess)
    console.log("[" + cidValue + "] guess: " + currentGuess)

    if (currentGuess == randomNumber) {
        var cheated = req.cs.get('cheated')
        req.cs.end()
        res.render('win', {
            randomNumber: randomNumber,
            guessCount: guessCount,
            cheated: cheated,
        })
        return
    }

    guessCount = guessCount+1
    req.cs.put('guessCount', guessCount)

    if (guessCount >= maxGuesses) {
        req.cs.end()
        res.render('lose', {
            randomNumber: randomNumber,
            guessCount: guessCount,
        })
        return
    }

    res.redirect('/?cid=' + cidValue)
})

app.get('/giveup', function (req, res, next) {
    var randomNumber = req.cs.get('randomNumber')
    req.cs.end()
    res.render('giveup', {
        randomNumber: randomNumber
    })
})

app.get('/cheat', function (req, res, next) {
    req.cs.put('cheated', true)
    var randomNumber = req.cs.get('randomNumber')
    var cidValue = req.cs.cidValue()
    res.render('cheat', {
        randomNumber: randomNumber,
        cidValue: cidValue,
    })
})

app.listen(3000, () => console.log('Example app listening on port 3000!\n'))
