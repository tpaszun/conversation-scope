'use strict';

var winston = require('winston');

const logger = winston.createLogger({
    level: 'error',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({ format: winston.format.simple() })
    ]
});

var ConversationScope = function (req, res, config) {
    logger.debug('new conversation scope');

    // save callbacks
    if (!config.getCallback || !config.putCallback) {
        throw new Error("Configuration must specify get and put callbacks")
    }

    // save excluded keys
    if (config.excludedKeys) {
        if (!Array.isArray(config.excludedKeys)) {
            throw new Error("Excluded keys must be in array");
        }
    }

    this._request = req;
    this._response = res;
    this._excludedKeys = config.excludedKeys || [];

    this.getCallback = config.getCallback;
    this.putCallback = config.putCallback;

    this.internalData = require('./tree.js');

    // bind conversation object
    req.cs = this;

    // add postprocessing middleware
    res.on('finish', this.postprocess);

    this.loadInternalData();
    this.initConversation();
};

/**
 * Postprocess given http request - response
 *
 * @param {Object} request Http request object
 * @param {Object} response Http response object
 * @param {function} callback
 */
ConversationScope.prototype.postprocess = function(req, res, callback) {
    logger.debug('Postprocessing...');
    logger.debug('');

    if (this.conversationLongType === false) {
        logger.debug('Destroy all data from temporary conversation');
        this.unsetAllKeys(this.conversationID);
        this.internalData.remove(this.conversationID);
        this.saveInternalData();
    }

    if (callback) {
        callback();
    }
};

/**
 * Recursively unset keys for provided cid
 *
 * @param {string} cid Cid
 */
ConversationScope.prototype.unsetAllKeys = function(cid) {
    var keys = this.internalData.getTransformedKeysToTop(cid);
    for (var i in keys) {
        var transformedKey = keys[i];
        logger.debug('Unset ' + i + ' (' + transformedKey + ')');
        this.putCallback(transformedKey, "");
    }
};

/**
 * Load internal data structure from session-store
 */
ConversationScope.prototype.loadInternalData = function() {
    var data = this.getCallback('csinternal');
    if (data !== undefined) {
        logger.debug('Load internal data from json: ' + data);
        this.internalData.load(data);
    }
};

/**
 * Save internal data structure to session-store
 */
ConversationScope.prototype.saveInternalData = function() {
    var str = this.internalData.export();
    logger.debug('Saving internal data: ' + str);
    this.putCallback('csinternal', str);
};


ConversationScope.prototype.put = function (key, value) {
    var transformedKey = key;
    // check if key is not on excluded list
    if (this._excludedKeys.indexOf(key) === -1) {
        transformedKey = this.getTransformedKeyForPut(key);
    }
    var ret = this.putCallback(transformedKey, value);
    logger.debug('Putting ' + value + ' under ' + transformedKey + ' (' + key + ')');
    return ret;
};

ConversationScope.prototype.get = function (key) {
    var transformedKey;
    // check if key is not on excluded list
    if (this._excludedKeys.indexOf(key) === -1) {
        transformedKey = this.getTransformedKeyForGet(key);
    }
    var data = this.getCallback(transformedKey);
    return data;
};

ConversationScope.prototype.cidValue = function () {
    return this.conversationID;
};

ConversationScope.prototype.begin = function ({ join = false, nested = false } = {}) {
    if (nested === true) {
        if (this.conversationLongType === false) {
            throw new Error('Cannot create nested conversation in temporary one');
        }
        logger.debug('Creating nested conversation and adding it to internal data');
        var oldConversationID = this.conversationID;
        this.conversationID = generateRandomID();
        this.internalData.addConversation(this.conversationID, oldConversationID);
        this.saveInternalData();
    } else if (join === false) {
        if (this.conversationLongType === true) {
            throw new Error('Conversation is already long-running')
        }
    }
    this.conversationLongType = true;
    return;
};

ConversationScope.prototype.end = function ({ root = false } = {}) {
    if (this.conversationLongType === false) {
        throw new Error('Cannot end temporary conversation');
    }
    this.unsetAllKeys(this.conversationID);

    var newConversationID;

    if (root === true) {
        newConversationID = this.internalData.remove();
    } else {
        newConversationID = this.internalData.remove(this.conversationID);
    }

    this.saveInternalData();

    if (newConversationID === null) {
        this.initTemporaryConversation();
    } else {
        this.conversationID = newConversationID;
    }
};

/**
 * Get transformed key from internal data in order to make GET
 *
 * @param {String} key Key to be transformed
 * @return {String|null} Transformed key
 */
ConversationScope.prototype.getTransformedKeyForGet = function(key) {
    logger.debug('Getting transformed key (get) for ' + key);
    var recursive = true;
    var transformedKey = this.internalData.getTransformedKey(this.conversationID, key, recursive);
    return transformedKey;
};

/**
 * Get transformed key from internal data in order to make PUT
 * (key is created if not exist)
 * @param {String} key Key to be transformed
 * @return {String|null} Transformed key
 */
ConversationScope.prototype.getTransformedKeyForPut = function(key) {
    logger.debug('Getting transformed key (put) for ' + key);
    var recursive = false;
    var transformedKey = this.internalData.getTransformedKey(this.conversationID, key, recursive);
    // create it if not exists
    if (transformedKey === null) {
        transformedKey = generateRandomKey(key);
        // update data structure
        this.internalData.addTransformedKey(this.conversationID, key, transformedKey);
        this.saveInternalData();
    }
    return transformedKey;
}

/**
 * Init conversation - create or load basing on 'cid'
 *
 * @param {String} seed Seed
 * @return {String} Random key
 */
ConversationScope.prototype.initConversation = function() {
    var cid;
    if (this._request.method === "GET") {
        cid = this._request.query.cid;
    } else if (this._request.method === "POST" && this._request.body && this._request.body.cid) {
        cid = this._request.body.cid;
    }
    if (cid !== undefined) {
        logger.debug('Load long-running conversation ' + cid);
        this.conversationID = cid;
        this.conversationLongType = true;
    } else {
        this.initTemporaryConversation();
    }
};

/**
 * Create random conversation and update internal data
 */
ConversationScope.prototype.initTemporaryConversation = function() {
    this.conversationID = generateRandomID();
    logger.debug('Create temporary conversation ' + this.conversationID + ' and add it to internalData');
    this.conversationLongType = false;
    this.internalData.addConversation(this.conversationID);
    this.saveInternalData();
};

/**
 * Generate random ID
 *
 * @param {String} seed Seed
 * @return {String} Random ID
 */
function generateRandomID(seed) {
    var id = "c" + String(Math.floor(Math.random() * 9e5));
    return id;
}

/**
 * Generate random key
 *
 * @param {String} seed Seed
 * @return {String} Random key
 */
function generateRandomKey(seed) {
    var key = "x" + String(Math.floor(Math.random() * 9e5));
    return key;
}

module.exports = ConversationScope;
