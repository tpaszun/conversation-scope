
module.exports = function(req) {
    var session = req.session;

    return {
        getCallback: function(key) {
            return session.get(key);
        },
        putCallback: function(key, value) {
            return session.put(key, value);
        }
    };
};
