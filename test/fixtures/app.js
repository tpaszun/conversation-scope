var result;

function unsetResult() {
    result = undefined;
}

function setResult(value) {
    if (result !== undefined) {
        throw new Error('Result cannot be overwritten. Consider making separate request');
    }
    result = value;
}

function getResult() {
    return result;
}

function makeApp()
{
    var express = require('express');
    var NodeSession = require('node-session');
    var ConversationScope = require("../../index-es6.js");
    var path = require('path');

    var session = new NodeSession({secret: 'Q3UBzdH9GEfiRCTKbi5MTPyChpzXLsTD'});
    var app = express();

    app.set('views', path.join(__dirname, './views'));
    app.set('view engine', 'ejs');

    app.use(function (req, res, next) {
        session.startSession(req, res, next);
    });

    app.use(function (req, res, next) {
        var config = {
            getCallback: function(key) {
                return req.session.get(key);
            },
            putCallback: function(key, value) {
                return req.session.put(key, value);
            }
        };
        new ConversationScope(req, res, config);

        next();
    });

    app.get('/', function (req, res, next) {
        var _result, op, error;
        var operations = req.query.operations.split("|");
        unsetResult();
        for (var i in operations) {
            op = operations[i].split(";");
            error = undefined;
            switch(op[0]) {
                case 'cidValue':
                    _result = req.cs.cidValue();
                    setResult(_result);
                    break;
                case 'put':
                    if (op[1] === undefined || op[2] === undefined) {
                        throw new Error("Missing arguments for put()");
                    }
                    req.cs.put(op[1], op[2]);
                    break;
                case 'get':
                    if (op[1] === undefined) {
                        throw new Error("Missing arguments for get()");
                    }
                    try {
                        _result = req.cs.get(op[1]);
                    } catch (e) {
                        error = e;
                    }
                    setResult(_result);
                    break;
                case 'begin':
                    var type = undefined, value = undefined;
                    if (op[1] !== undefined) {
                        arg = op[1].split("=");
                        // check if arguments are correct
                        if (["join","nested"].indexOf(arg[0]) === -1 || arg[1] === undefined) {
                            throw new Error("Incorrect arguments for begin()");
                        }
                        type = arg[0];
                        value = (arg[1] == 'true');
                    }
                    try {
                        if (type === undefined) {
                            req.cs.begin();
                        } else if (type === "join") {
                            req.cs.begin({join: value});
                        } else if (type === "nested") {
                            req.cs.begin({nested: value});
                        } else {

                        }
                    } catch (e) {
                        error = e;
                    }
                    break;
                case 'end':
                    type = undefined;
                    value = undefined;
                    if (op[1] !== undefined) {
                        arg = op[1].split("=");
                        // check if arguments are correct
                        if (["root"].indexOf(arg[0]) === -1 || arg[1] === undefined) {
                            throw new Error("Incorrect arguments for end()");
                        }
                        type = arg[0];
                        value = (arg[1] == 'true');
                    }
                    try {
                        if (type === "root") {
                            req.cs.end({root: value});
                        } else {
                            req.cs.end();
                        }
                    } catch (e) {
                        error = e;
                    }
                    break;
                default:
                    throw new Error("Invalid operation type " + op.type);
            }
            if (error) {
                res.status(500).send(error);
                return;
            }
        }
        res.status(200).send(getResult());
    });

    return app;
}

module.exports = makeApp;
