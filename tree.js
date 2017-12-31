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
 * Recursively get all cids for provided nodes
 *
 * @param {object[]} nodes Nodes
 * @param {boolean} recursive Whether search to down
 */
function getSubCidsLoop(mainNode, recursive) {
    var subcids, result = []
    var node, data = mainNode['conversations']
    for (var i in data) {
        node = data[i]
        result.push(node['cid'])
        if (recursive === true) {
            subcids = getSubCidsLoop(node)
            result = result.concat(subcids)
        }
    }
    return result
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
 * Lookdown for subconversations' cids
 *
 * @param {string} cid Cid
 * @param {boolean} [recursive=false] Whether search to down
 * @return {string[]} Subconversations' cids
 *
 * @throws Will throw an error if conversation does not exist
 */
Tree.prototype.getSubCids = function (cid, recursive = false) {
    var node = search(cid)
    if (node === null) {
        throw new Error("Conversation with cid " + cid + " does not exist")
    }
    var conversations = getSubCidsLoop(node, recursive)
    return conversations
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
 * @param {boolean} recursive Whether search recursively to top
 * @return {string|null} Tranformed key
 *
 * @throws Will throw an error if conversation does not exist
 */
Tree.prototype.getTransformedKey = function (cid, key, recursive) {
    var node = search(cid)
    if (node === null) {
        throw new Error("Conversation with cid " + cid + " does not exist")
    }
    console.log("Found node:", node)
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
        console.log("one level up..")
    }
    return transformatedKey
}

/**
 * Fetch all transformated keys for provided cid
 *
 * @param {string} cid Cid
 * @return {string[]} Tranformed keys
 *
 * @throws Will throw an error if conversation does not exist
 */
Tree.prototype.getTransformedKeys = function (cid) {
    var node = search(cid)
    if (node == null) {
        throw new Error("Conversation with cid " + cid + " does not exist")
    }
    return node['transformedKeys']
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

/* ONLY FOR DEBUG */
Tree.prototype.show = function () {
    return JSON.stringify(data, function(key, value) {
        if (key == 'parent') {
            return "#Reference"
        } else {
            return value
        }
    })
}

module.exports = new Tree();
