/* functions */

const Collection    = require('../collections/collection')

const fetchRandom = async (count) => {
    return await Collection.findOne({ special: false }).skip(Math.floor(Math.random() * count))
}

const byAlias = (ctx, name) => {
    const regex = new RegExp(name, 'gi')
    return ctx.collections.filter(x => x.aliases.filter(y => regex.test(name))[0])
        .sort((a, b) => a.id.length - b.id.length)[0]
}

module.exports = {
    fetchRandom,
    byAlias,
}
