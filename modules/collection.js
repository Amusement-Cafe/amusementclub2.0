/* functions */

const Collection    = require('../collections/collection')
const config        = require('../config')

const fetchRandom = async (count) => {
    return await Collection.findOne({ special: false }).skip(Math.floor(Math.random() * count))
}

module.exports = {
    fetchRandom,
}

/* commands */