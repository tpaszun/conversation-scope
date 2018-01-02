function createHandler(cs) {
    return {
        get: function(target, name, receiver) {
            if (name === "put" && name in target.__proto__) {
                return function(key, value) {
                    return cs.put(key, value)
                }
            } else if (name === "get" && name in target.__proto__) {
                return function(key, def) {
                    var val = cs.get(key)
                    if (!val && def !== undefined) {
                        // no data, so return default value
                        return def
                    }
                    return val
                }
            } else {
                return Reflect.get(target, name, receiver)
            }
        },
    }
}

module.exports = createHandler
