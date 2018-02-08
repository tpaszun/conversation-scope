var fs = require('fs');

var data = {};

if (fs.existsSync('conversationData.json'))
    data = JSON.parse(fs.readFileSync('conversationData.json', { encoding: 'utf8' }));

module.exports = {
    getCallback: function(key) {
        return data[key];
    },

    putCallback: function(key, value) {
        data[key] = value;
        fs.writeFileSync('conversationData.json', JSON.stringify(data));
    }
};