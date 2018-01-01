'use strict';

var Tree = function () {
    init()
}

/**
 * @type {object} Internal structure describing conversation tree
 */
var data = undefined;

/**
 * Init data structure
 */
function init() {
    data = newNode(null, 'root')
}

/**
 * Restore initial data strucutre
 */
function reset() {
    data = undefined
    init()
}

/**
 * Create node object with setted parent (which may be inserted in tree)
 *
 * @param {object} [parent=null] Reference to parent node
 * @param {string} cid Cid
 * @return {object} Node object
 */
function newNode(parent = null, cid) {
    var node = {}
    node['parent'] = parent
    node['cid'] = cid
    node['transformedKeys'] = {}
    node['conversations'] = []
    return node
}

/**
 * Travel through internal data strucutre and fix references to parent nodes
 *
 * @param {object} data Internal strucutre
 */
function fixParentReferences(data) {
    var node, subnodes = data['conversations']
    for (var i in subnodes) {
        node = subnodes[i]
        node['parent'] = data
        fixParentReferences(node)
    }
}

/**
 * Recursively search data with provided cid
 *
 * @param {string} cid Cid to search
 * @return {object|null} Reference to founed node
 */
function search(cid) {
    return searchLoop(data, cid)
}

/**
 * Recursively search nodes with provided cid
 *
 * @param {object} node Node
 * @param {string} cid Cid to search
 * @return {object|null} Reference to founed node
 */
function searchLoop(node, cid) {
    // check if we found correct conversation
    if (node['cid'] === cid) {
        return node
    }
    // if not, then check sub-conversations
    var f = null;
    for (var i in node['conversations']) {
        f = searchLoop(node['conversations'][i], cid)
        if (f !== null) {
            return f
        }
    }
    // if no results, then return null
    return null;
}

/**
 * Add conversation to tree
 *
 * @param {string} cid Cid of new conversation
 * @param {string} [parentCid='root'] Parent cid under which conversation will be inserted
 */
Tree.prototype.addConversation = function (cid, parentCid = 'root') {
    var parentNode = search(parentCid);
    if (parentNode === null) {
        throw new Error("Conversation with cid " + parentCid + " does not exist")
    }
    var node = newNode(parentNode, cid)
    parentNode['conversations'].push(node)
}

/**
 * Remove data from tree
 *
 * @param {string} [cid=root] Cid of conversation to remove
 * @return {string|null} Cid of conversation which can be resumed
 */
Tree.prototype.remove = function (cid = 'root') {
    if (cid === 'root') {
        reset()
        return null
    }
    var node = search(cid);
    if (node === null) {
        throw new Error("Conversation with cid " + cid + " does not exist")
    }
    var parentNode = node.parent
    // this look complex, but it is necessary for keeping correct references
    parentNode['conversations'] = parentNode['conversations'].filter(
        function(el) {
            return el.cid !== cid;
        }
    );
    // not allow to resume root conv.
    if (parentNode.cid === 'root') {
        return null
    }
    return parentNode.cid
}

/**
 * Add key with transformation to conversation's data
 *
 * @param {string} cid Cid
 * @param {string} key Key
 * @param {string} tranformedKey Tranformed key
 *
 * @throws Will throw an error if conversation does not exist
 */
Tree.prototype.addTransformedKey = function (cid, key, transformedKey) {
    var node = search(cid)
    if (node === null) {
        throw new Error("Conversation with cid " + cid + " does not exist")
    }
    node['transformedKeys'][key] = transformedKey
}

/**
 * Lookup transformation of key in tree
 *
 * @param {string} cid Cid
 * @param {string} key Key
 * @param {boolean} recursive Whether search recursively to BOTTOM (root)
 * @return {string|null} Tranformed key
 *
 * @throws Will throw an error if conversation does not exist
 */
Tree.prototype.getTransformedKey = function (cid, key, recursive) {
    var node = search(cid)
    if (node === null) {
        throw new Error("Conversation with cid " + cid + " does not exist")
    }
    var transformatedKey = null
    while (true) {
        if (node['transformedKeys'][key] !== undefined) {
            transformatedKey = node['transformedKeys'][key]
            break
        }
        if (recursive === false || node.parent === null) {
            break
        }
        node = node.parent
    }
    return transformatedKey
}

/**
 * Recursively fetch all transformated keys for provided cid
 *
 * @param {string} cid Cid
 * @return {string[]} Tranformed keys
 *
 * @throws Will throw an error if conversation does not exist
 */
Tree.prototype.getTransformedKeysToTop = function (cid) {
    var node = search(cid)
    if (node == null) {
        throw new Error("Conversation with cid " + cid + " does not exist")
    }
    var tranformedKeys = getTransformedKeysToTopLoop(node)
    return tranformedKeys
}

/**
 * Internal function for recursive getting transformed keys for provided node
 *
 * @param {object} mainNode Node
 * @return {string[]} Array of transformated keys
 */
function getTransformedKeysToTopLoop(mainNode) {
    var data, result = []
    data = mainNode['transformedKeys']
    // add keys to result array
    for (var property in data) {
        if (data.hasOwnProperty(property)) {
            result.push(data[property])
        }
    }
    // check subconversations
    var subKeys
    data = mainNode['conversations']
    for (var i in data) {
        subKeys = getTransformedKeysToTopLoop(data[i])
        result = result.concat(subKeys)
    }
    return result
}

/**
 * Load internal data from JSON string
 *
 * @param {string} json JSON
 */
Tree.prototype.load = function (json) {
    var rawData = JSON.parse(json)
    fixParentReferences(rawData)
    data = rawData
}

/**
 * Return internal data parsed to string
 * (references to parents are skipped)
 * @return {string} internal data
 */
Tree.prototype.export = function () {
    var str = JSON.stringify(data, function(key, value) {
        if (key === 'parent') {
            return null
        }
        return value
    })
    return str
}

module.exports = new Tree();
