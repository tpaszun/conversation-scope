'use strict';

var winston = require('winston')

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({format: winston.format.simple()})
  ]
});

var ConversationScope = function () {}

/**
 * @type {Object} Reference to (current) http request object
 */
var request = undefined

/**
 * @type {function} Function which will be called internally to get data from session
 */
var getCallback = undefined

/**
 * @type {function} Function which will be called internally to put data to session
 */
var putCallback = undefined

/**
 * @type {Object} Internal data structure (conversations tree and transformed keys)
 */
var internalData = require('./tree.js')

/**
 * @type {Object} Current conversation ID in request
 */
var conversationID = undefined

/**
 * @type {boolean} Determine if conversation is long-running or temporary
 */
var conversationLongType = undefined

/**
 * @var {string[]} - list of keys, which should be out of conversation scopes
 */
var excludedKeys = []

/**
 * Run module with the given `options`
 *
 * @param {object} request Http request object
 * @param {object} response Http response object
 * @param {function} next Callback
 * @param {object} options Module options
 */
ConversationScope.prototype.run = function (req, res, next, config) {
    // save callbacks
    if (!config.getCallback || !config.putCallback) {
        throw new Error("Configuration must specify get and put callbacks")
    }
    getCallback = config.getCallback
    putCallback = config.putCallback
    // save excluded keys
    if (config.excludedKeys) {
        if(!Array.isArray(config.excludedKeys)) {
            throw new Error("Excluded keys must be in array")
        }
        excludedKeys = config.excludedKeys
    }
    // add postprocessing middleware
    res.on('finish', postprocess);
    // run preprocessing
    preprocess(req, res)
    // call next
    next()
}

/**
 * Preprocess given http request - response
 *
 * @param {object} request Http request object
 * @param {object} response Http response object
 */
function preprocess (req, res) {
    // save reference to request
    request = req

    logger.debug('Preprocessing...')

    loadInternalData()

    addMethods()
    initCoversation()
};

/**
 * Postprocess given http request - response
 *
 * @param {Object} request Http request object
 * @param {Object} response Http response object
 * @param {function} callback
 */
function postprocess(req, res, callback) {
    logger.debug('Postprocessing...')
    logger.debug('')

    if (conversationLongType === false) {
        logger.debug('Destroy all data from temporary conversation')
        unsetAllKeys(conversationID)
        internalData.remove(conversationID)
        saveInternalData()
    }

    if (callback) {
        callback()
    }
};

/**
 * Recursively unset keys for provided cid
 *
 * @param {string} cid Cid
 */
function unsetAllKeys(cid) {
    var keys = internalData.getTransformedKeysToTop(cid)
    for (var i in keys) {
        var transformedKey = keys[i]
        logger.debug('Unset ' + i + ' (' + transformedKey + ')')
        putCallback(transformedKey, "")
    }
}

/**
 * Load internal data structure from session-store
 */
function loadInternalData() {
    var data = getCallback('csinternal')
    if (data !== undefined) {
        logger.debug('Load internal data from json: ' + data )
        internalData.load(data)
    }
}

/**
 * Save internal data structure to session-store
 */
function saveInternalData() {
    var str = internalData.export()
    logger.debug('Saving internal data: ' + str)
    putCallback('csinternal', str)
}

/**
 * Add conversation base methods to request, like begin(), get() or end()
 */
function addMethods()
{
    var cs = []
    cs['put'] = function(key, value) {
        var transformedKey = key
        // check if key is not on excluded list
        if (excludedKeys.indexOf(key) === -1) {
            transformedKey = getTransformedKeyForPut(key)
        }
        var ret = putCallback(transformedKey, value)
        logger.debug('Putting ' + value + ' under ' + transformedKey + ' (' + key + ')')
        return ret
    }
    cs['get'] = function(key) {
        var transformedKey
        // check if key is not on excluded list
        if (excludedKeys.indexOf(key) === -1) {
            transformedKey = getTransformedKeyForGet(key)
        }
        var data = getCallback(transformedKey)
        return data
    }
    cs['cidValue'] = function() {
        return conversationID
    }
    cs['begin'] = function({join = false, nested = false} = {}) {
        if (nested === true) {
            if (conversationLongType === false) {
                throw new Error('Cannot create nested conversation in temporary one')
            }
            logger.debug('Creating nested conversation and adding it to internal data')
            var oldConversationID = conversationID
            conversationID = generateRandomID();
            internalData.addConversation(conversationID, oldConversationID)
            saveInternalData()
        } else if (join === false) {
            if (conversationLongType === true) {
                throw new Error('Conversation is already long-running')
            }
        }
        conversationLongType = true
        return
    }
    cs['end'] = function({root = false} = {}) {
        if (conversationLongType === false) {
            throw new Error('Cannot end temporary conversation')
        }
        unsetAllKeys(conversationID)
        var newConversationID = undefined
        if (root === true) {
            newConversationID = internalData.remove()
        } else {
            newConversationID = internalData.remove(conversationID)
        }
        saveInternalData()
        if (newConversationID === null) {
            initTemporaryConversation()
        } else {
            conversationID = newConversationID
        }
    }
    request['cs'] = cs
}

/**
 * Get transformed key from internal data in order to make GET
 *
 * @param {String} key Key to be transformed
 * @return {String|null} Transformed key
 */
function getTransformedKeyForGet(key) {
    logger.debug('Getting transformed key (get) for ' + key)
    var recursive = true
    var transformedKey = internalData.getTransformedKey(conversationID, key, recursive)
    return transformedKey
}

/**
 * Get transformed key from internal data in order to make PUT
 * (key is created if not exist)
 * @param {String} key Key to be transformed
 * @return {String|null} Transformed key
 */
function getTransformedKeyForPut(key) {
    logger.debug('Getting transformed key (put) for ' + key)
    var recursive = false
    var transformedKey = internalData.getTransformedKey(conversationID, key, recursive)
    // create it if not exists
    if (transformedKey === null) {
        transformedKey = generateRandomKey(key)
        // update data structure
        internalData.addTransformedKey(conversationID, key, transformedKey)
        saveInternalData()
    }
    return transformedKey
}

/**
 * Generate random key
 *
 * @param {String} seed Seed
 * @return {String} Random key
 */
function generateRandomKey(seed)
{
    var key = "x"+String(Math.floor(Math.random() * 9e5))
    return key
}

/**
 * Init conversation - create or load basing on 'cid'
 *
 * @param {String} seed Seed
 * @return {String} Random key
 */
function initCoversation() {
    var cid = undefined
    if (request.method === "GET") {
        cid = request.query.cid
    } else if (request.method === "POST" && request.body && request.body.cid) {
        cid = request.body.cid
    }
    if (cid !== undefined) {
        logger.debug('Load long-running conversation ' + cid)
        conversationID = cid
        conversationLongType = true
    } else {
        initTemporaryConversation()
    }
}

/**
 * Create random conversation and update internal data
 */
function initTemporaryConversation() {
    conversationID = generateRandomID();
    logger.debug('Create temporary conversation ' + conversationID
                + ' and add it to internalData')
    conversationLongType = false
    internalData.addConversation(conversationID)
    saveInternalData()
}

/**
 * Generate random ID
 *
 * @param {String} seed Seed
 * @return {String} Random ID
 */
function generateRandomID(seed)
{
    var id = "c"+String(Math.floor(Math.random() * 9e5))
    return id
}

module.exports = new ConversationScope();
