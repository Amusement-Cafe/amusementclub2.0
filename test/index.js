const config    = require('./config')
const amusement = require('../index.js')
const _         = require('lodash')

var userq       = require('../utils/userq')

const main = async () => {
    const data = {
        cards: require('./data/cards.json'),
        collections: require('./data/collections.json'),
        help: require('./data/help.json'),
        items: require('./data/items.json'),
        achievements: require('./data/achievements.js'),
    }

    const options  = Object.assign({shard: 0, data}, config)
    const instance = await amusement.start(options)

    const tick = () => {
        const now = new Date()
        _.remove(userq, (x) => x.expires < now)
    }

    setInterval(tick.bind(this), 1000);

    instance.on('error', err => {
        console.error(err)
    })

    // instance.stop()
}

main().catch(console.error)
