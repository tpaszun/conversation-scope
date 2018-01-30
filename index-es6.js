'use strict';

var winston = require('winston');

const logger = winston.createLogger({
    level: 'error',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({ format: winston.format.simple() })
    ]
});

class ConversationScope {
    constructor(req, res, config) {
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

        // bind properties
        this._request = req;
        this._response = res;
        this._excludedKeys = config.excludedKeys || [];

        // bind callbacks
        this.getCallback = config.getCallback;
        this.putCallback = config.putCallback;

        // setup tree
        this.internalData = require('./tree.js');

        // bind conversation object
        req.cs = this;

        // add postprocessing middleware
        res.on('finish', this.postprocess);

        this.loadInternalData();
        this.initConversation();
    }

    /**
     * Postprocess given http request - response
     *
     * @param {Object} request Http request object
     * @param {Object} response Http response object
     * @param {function} callback
     */
    postprocess(req, res, callback) {
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
    }

    /**
     * Recursively unset keys for provided cid
     *
     * @param {string} cid Cid
     */
    unsetAllKeys(cid) {
        var keys = this.internalData.getTransformedKeysToTop(cid);
        for (var i in keys) {
            var transformedKey = keys[i];
            logger.debug('Unset ' + i + ' (' + transformedKey + ')');
            this.putCallback(transformedKey, "");
        }
    }

    /**
     * Load internal data structure from session-store
     */
    loadInternalData() {
        var data = this.getCallback('csinternal');
        if (data !== undefined) {
            logger.debug('Load internal data from json: ' + data);
            this.internalData.load(data);
        }
    }

    /**
     * Save internal data structure to session-store
     */
    saveInternalData() {
        var str = this.internalData.export();
        logger.debug('Saving internal data: ' + str);
        this.putCallback('csinternal', str);
    }

    put(key, value) {
        var transformedKey = key;
        // check if key is not on excluded list
        if (this._excludedKeys.indexOf(key) === -1) {
            transformedKey = this.getTransformedKeyForPut(key);
        }
        var ret = this.putCallback(transformedKey, value);
        logger.debug('Putting ' + value + ' under ' + transformedKey + ' (' + key + ')');
        return ret;
    }

    get(key) {
        var transformedKey;
        // check if key is not on excluded list
        if (this._excludedKeys.indexOf(key) === -1) {
            transformedKey = this.getTransformedKeyForGet(key);
        }
        var data = this.getCallback(transformedKey);
        return data;
    }

    cidValue() {
        return this.conversationID;
    }

    begin({ join = false, nested = false } = {}) {
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
    }

    end({ root = false } = {}) {
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
    }

    /**
     * Get transformed key from internal data in order to make GET
     *
     * @param {String} key Key to be transformed
     * @return {String|null} Transformed key
     */
    getTransformedKeyForGet(key) {
        logger.debug('Getting transformed key (get) for ' + key);

        var recursive = true;
        var transformedKey = this.internalData.getTransformedKey(this.conversationID, key, recursive);
        return transformedKey;
    }

    /**
     * Get transformed key from internal data in order to make PUT
     * (key is created if not exist)
     * @param {String} key Key to be transformed
     * @return {String|null} Transformed key
     */
    getTransformedKeyForPut(key) {
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
    initConversation() {
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
    }

    /**
     * Create random conversation and update internal data
     */
    initTemporaryConversation() {
        this.conversationID = generateRandomID();
        logger.debug('Create temporary conversation ' + this.conversationID + ' and add it to internalData');
        this.conversationLongType = false;
        this.internalData.addConversation(this.conversationID);
        this.saveInternalData();
    }
}

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
