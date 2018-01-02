var result

function unsetResult() {
    result = undefined
}

function setResult(value) {
    if (result !== undefined) {
        throw new Error('Result cannot be overwritten. Consider making separate request')
    }
    result = value
}

function getResult() {
    return result
}

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
        var _result, op, error
        var operations = req.query.operations.split("|")
        unsetResult()
        for (i in operations) {
            op = operations[i].split(";")
            error = undefined
            switch(op[0]) {
                case 'cidValue':
                    _result = req.cs.cidValue()
                    setResult(_result)
                    break;
                case 'put':
                    req.cs.put(op[1], op[2])
                    break;
                case 'get':
                    try {
                        _result = req.cs.get(op[1])
                    } catch (e) {
                        error = e
                    }
                    setResult(_result)
                    break;
                case 'begin':
                    var type = undefined, value = undefined
                    if (op[1]) {
                        arg = op[1].split("=")
                        type = arg[0]
                        value = arg[1]
                    }
                    try {
                        if (type === "join" && value === "true") {
                            req.cs.begin({join: true})
                        } else if (type === "nested" && value === "true") {
                            req.cs.begin({nested: true})
                        } else {
                            req.cs.begin()
                        }
                    } catch (e) {
                        error = e
                    }
                    break
                case 'end':
                    var type = undefined, value = undefined
                    if (op[1]) {
                        arg = op[1].split("=")
                        type = arg[0]
                        value = arg[1]
                    }
                    try {
                        if (type === "root" && value === "true") {
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
        res.status(200).send(getResult())
    })

    return app;
}

module.exports = makeApp;
