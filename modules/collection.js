/* functions */

const Collection    = require('../collections/collection')

const fetchRandom = async (count) => {
    return await Collection.findOne({ special: false }).skip(Math.floor(Math.random() * count))
}

const byName = async (name) => {
    return (await Collection.find({ aliases: new RegExp(name, 'gi') }))
        .sort((a, b) => a.id.length - b.id.length)[0]
}

module.exports = {
    fetchRandom,
    byName,
}
