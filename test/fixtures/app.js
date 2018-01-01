function makeApp()
{
    var express = require('express');
    var NodeSession = require('node-session');
    var ConversationScope = require("../../index.js")
    var path = require('path');

    var session = new NodeSession({secret: 'Q3UBzdH9GEfiRCTKbi5MTPyChpzXLsTD'});
    var app = express();

    app.set('views', path.join(__dirname, './views'));
    app.set('view engine', 'ejs');

    app.use(function (req, res, next) {
        session.startSession(req, res, next);
    });

    app.use(function (req, res, next) {
        ConversationScope.preprocess(req, res, next)
        res.on('finish', ConversationScope.postprocess);
    })

    app.get('/', function (req, res, next) {
        var operations = JSON.parse(req.query.operations)
        if (!operations || !Array.isArray(operations)) {
            throw new Error("Invalid operations")
        }
        var result, op, error
        for (i in operations) {
            op = operations[i]
            error = undefined
            switch(op.fn) {
                case 'cidValue':
                    result = req.cs.cidValue()
                    break;
                case 'put':
                    req.cs.put(op.args.key, op.args.value)
                    break;
                case 'get':
                    try {
                        result = req.cs.get(op.args.key)
                    } catch (e) {
                        error = e
                    }
                    break;
                case 'begin':
                    try {
                        if (op.args.join === true) {
                            req.cs.begin({join: true})
                        } else if (op.args.nested == true) {
                            req.cs.begin({nested: true})
                        } else {
                            req.cs.begin()
                        }
                    } catch (e) {
                        error = e
                    }
                    break
                case 'end':
                    try {
                        if (op.args.root === true) {
                            req.cs.end({root: true})
                        } else {
                            req.cs.end()
                        }
                    } catch (e) {
                        error = e
                    }
                    break;
                default:
                    throw new Error("Invalid operation type " + op.type)
            }
            if (error) {
                res.status(500).send(error)
                return
            }
        }
        res.status(200).send(result)
    })

    return app;
}

module.exports = makeApp;
