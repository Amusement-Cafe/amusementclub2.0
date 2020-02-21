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
        quests: require('./data/quests.js'),
        promos: require('./data/promos.json').map(
            x => Object.assign({}, x, {
            starts: Date.parse(x.starts),
            expires: Date.parse(x.expires)
        })),
        boosts: require('./data/boosts.json').map(
            x => Object.assign({}, x, {
            starts: Date.parse(x.starts),
            expires: Date.parse(x.expires)
        }))
    }

    const options  = Object.assign({shards: 1, data}, config, debug)
    const instance = await amusement.create(options)

    await instance.connect()

    instance.emitter.on('info', data => {
        console.log(data)
    })

    instance.emitter.on('error', err => {
        console.error(err)
    })
}

main().catch(console.error)
