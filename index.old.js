'use strict';

/**
 * @var {string[]} - list of keys, which should be out of conversation scopes
 */
var excludedKeys = ['flash.old', 'flash.new']

/**
 * @var {string} - name of origin session variable
 */
var sessionOriginName = 'session'

/**
 * @var {string} - name of variable with conversations' data
 */
var conversationsDataName = 'conversation_data'

/**
 * @var {string} - name of function generating cid
 */
var cidGeneratorName = 'generateCid'

var ConversationScope = function () {}

/**
 * Init conversations for a given http request - response
 *
 * @param {Object} request - http request object
 * @param {Object} response - http response object
 * @param {function} callback
 */
ConversationScope.prototype.init = function (request, response, callback) {
    // check if session is available
    if (request[sessionOriginName] === undefined) {
        //process.stdout.write("ERROR: No session available! You should use session plugin!\n")
    }

    loadInternalData(request)
    addCidGenerator(request)
    proxyMethods(request)

    callback();
};

function proxyMethods(request)
{
    //process.stdout.write("proxyMethods({request}) {\n")
    request[sessionOriginName] = new Proxy(request[sessionOriginName], {
        get: function(target, name, receiver) {
            if (name === "put" && name in target.__proto__) {
                return function(...args) {
                    //process.stdout.write("request.session.put(" + args[0] + ", " + args[1] + ") {\n")
                    var forceCreate = false

                    if (excludedKeys.indexOf(key) === -1) {
                        forceCreate = true
                    }

                    //get or create transformed key
                    var key = getTransformedKey(request, args[0], forceCreate)
                    args[0] = key

                    //save internal data structure
                    //process.stdout.write("Saving internal data:")
                    //process.stdout.write(JSON.stringify(request[sessionOriginName][conversationsDataName]) + "\n\n")
                    target[name](conversationsDataName, JSON.stringify(request[sessionOriginName][conversationsDataName]))

                    //set value
                    var ret =  target[name](args[0], args[1])
                    //process.stdout.write("} -> return " + ret)
                    //process.stdout.write("\n\n")
                    return ret
                }
            } else if (name === "get" && name in target.__proto__) { // assume method live on the prototype
                return function(...args) {
                    //process.stdout.write("request.session.get(" + args[0] + ", " + args[1] + ") {\n")
                    var key = getTransformedKey(request, args[0])
                    var data = target[name](key, args[1])
                    //process.stdout.write("} -> return " + data)
                    //process.stdout.write("\n\n")
                    return data
                }
            } else if (name === "begin") {
                return function() {
                    //process.stdout.write("request.session.begin() {\n")
                    var cid = request.query.cid
                    if (cid !== undefined) {
                        loadCoversation(request, cid)
                    }
                    //process.stdout.write("}")
                    //process.stdout.write("\n\n")
                    return cid
                }
            } else {
                return Reflect.get(target, name, receiver)
            }
        },
    });
    //process.stdout.write("} -> ok.\n\n")
}

function _arrayifyMap(m)
{
    if (m.constructor === Map) {
        return [...m].map(([v,k]) => [_arrayifyMap(v), _arrayifyMap(k)])
    }
    return m
}

function loadCoversation(req, cid)
{
    //process.stdout.write("loadCoversation({request}, " + cid + ") {\n")
    //create conversation if necessary
    if (req[sessionOriginName][conversationsDataName][cid] === undefined) {
        req[sessionOriginName][conversationsDataName][cid] = {}
    }
    req.currentScope = cid
    //process.stdout.write("} -> request.currentScope = " + cid)
    //process.stdout.write("\n\n")
}

function addCidGenerator(request)
{
    //process.stdout.write("addCidGenerator({request}) {\n")
    request[sessionOriginName][cidGeneratorName] = function(name) {
        var cid = "y"+String(Math.floor(Math.random() * 9e5))
        return cid
    }
    //process.stdout.write("} -> request." + sessionOriginName + "." + cidGeneratorName + " = function(name) {..}")
    //process.stdout.write("\n\n")
}

function loadInternalData(request)
{
    //process.stdout.write("loadInternalData({request}) {\n")
    var saved_data = request[sessionOriginName].get(conversationsDataName);
    if (saved_data !== undefined) {
        request[sessionOriginName][conversationsDataName] = JSON.parse(saved_data)
    } else {
        request[sessionOriginName][conversationsDataName] = {};
    }
    //process.stdout.write("} -> request." + sessionOriginName + "." + conversationsDataName + " = " + JSON.stringify(request[sessionOriginName][conversationsDataName]))
    //process.stdout.write("\n\n")
}

function getTransformedKey(request, name, create = false)
{
    //process.stdout.write("getTransformedKey({request}, " + name + ", " + create + ") {\n")
    key = name
    if (request.currentScope !== undefined) {
        var key = request[sessionOriginName][conversationsDataName][request.currentScope][name]
        if (key === undefined && create === true) {
            key = generateKey(name)
            request[sessionOriginName][conversationsDataName][request.currentScope][name] = key
        }
    }
    //process.stdout.write("} -> return " + key)
    //process.stdout.write("\n\n")
    return key
}

function generateKey(name)
{
    //process.stdout.write("generateKey(" + name + ") {\n")
    var key = "x"+String(Math.floor(Math.random() * 9e5))
    //process.stdout.write("} -> return " + key)
    //process.stdout.write("\n\n")
    return key
}

/**
 * NEW CODE
 */

/**
 * Init conversations for a given http request - response
 *
 * @param {Object} request - http request object
 * @param {Object} response - http response object
 * @param {function} callback
 */
ConversationScope.prototype.xinit = function (request, response, callback) {

    //loadInternalData(request)
    addCidGenerator(request)
    proxyMethods(request)
    xInit(request)

    callback();
};

function xInit(req)
{
    req['cs'] = []
    req['cs']['put'] = function(key, value) {
        return
    }
    req['cs']['get'] = function(key) {
        return "";
    }
    req['cs']['cidValue'] = function() {
        return ""
    }
    req['cs']['begin'] = function() {
        return
    }
}

module.exports = new ConversationScope();
