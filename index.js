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
 * Preprocess given http request - response
 * @param {Object} request Http request object
 * @param {Object} response Http response object
 * @param {function} callback
 */
ConversationScope.prototype.preprocess = function (req, res, callback) {
    // save reference to request
    request = req

    logger.debug('Preprocessing...')

    loadInternalData()

    addMethods()
    initCoversation()

    callback()
};

/**
 * Postprocess given http request - response
 * @param {Object} request Http request object
 * @param {Object} response Http response object
 * @param {function} callback
 */
ConversationScope.prototype.postprocess = function (req, res, callback) {
    logger.debug('Postprocessing...')

    if (conversationLongType === false) {
        logger.debug('Destroy all data from temporary conversation')
        var keys = internalData.getTransformedKeys(conversationID)
        for (var i in keys) {
            var transformedKey = keys[i]
            logger.debug('Unset ' + i + ' (' + transformedKey + ')')
            request.session.put(transformedKey, "")
        }
    }

    if (callback) {
        callback()
    }
};

/**
 * Load internal data structure from session-store
 */
function loadInternalData() {
    var data = request.session.get('csinternal')
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
    request.session.put('csinternal', str)
}

/**
 * Add conversation base methods to request, like begin(), get() or end()
 */
function addMethods()
{
    var cs = []
    cs['put'] = function(key, value) {
        var transformedKey = getTransformedKeyForPut(key)
        var ret = request.session.put(transformedKey, value)
        logger.debug('Putting ' + value + ' under ' + transformedKey + ' (' + key + ')')
        return ret
    }
    cs['get'] = function(key) {
        var transformedKey = getTransformedKeyForGet(key)
        var data = request.session.get(transformedKey)
        return data
    }
    cs['cidValue'] = function() {
        return conversationID
    }
    cs['begin'] = function({join = false, nested = false} =  {}) {
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
    }
    request['cs'] = cs
}

/**
 * Get transformed key from internal data in order to make GET
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
 * @param {String} seed Seed
 * @return {String} Random key
 */
function initCoversation() {
    var cid = request.query.cid
    if (cid !== undefined) {
        logger.debug('Load long-running conversation ' + cid)
        conversationID = cid
        conversationLongType = true
    } else {
        conversationID = generateRandomID();
        logger.debug('Create temporary conversation ' + conversationID
                    + ' and add it to internalData')
        conversationLongType = false
        internalData.addConversation(conversationID)
        saveInternalData()
    }
}

/**
 * Generate random ID
 * @param {String} seed Seed
 * @return {String} Random ID
 */
function generateRandomID(seed)
{
    var id = "c"+String(Math.floor(Math.random() * 9e5))
    return id
}

module.exports = new ConversationScope();
