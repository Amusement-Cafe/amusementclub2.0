const config    = require('./config')
const amusement = require('../index.js')
const _         = require('lodash')

const main = async () => {
    const data = {
        cards: require('./data/cards.json'),
        collections: require('./data/collections.json'),
        bannedwords: ['loli', 'shouta'],
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

    console.log(`Working with ${data.cards.length} cards and ${data.collections.length} collections`)
    const options  = Object.assign({shards: 1, data}, config)
    const instance = await amusement.create(options)

    await instance.connect()

    instance.emitter.on('info', i => {
        console.log(i)
    })

    instance.emitter.on('error', err => {
        console.error(err)
    })
}

main().catch(console.error)
