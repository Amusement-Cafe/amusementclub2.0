const config    = require('./config')
const amusement = require('../index.js')
const _         = require('lodash')

const main = async () => {
    const debug = true
    const data = {
        cards: require('./data/cards.json'),
        collections: require('./data/collections.json'),
        help: require('./data/help.json'),
        items: require('./data/items.json'),
        achievements: require('./data/achievements.js'),
    }

    const options  = Object.assign({shards: 1, data}, config, debug)
    const instance = (await amusement.start(options)).emitter

    instance.on('info', data => {
        console.log(data)
    })

    instance.on('error', err => {
        console.error(err)
    })

    // instance.stop()
}

main().catch(console.error)
