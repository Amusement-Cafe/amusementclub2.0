const config    = require('./config')
const _         = require('lodash')
const child     = require('child_process')

const main = async () => {
    const data = {
        cards: require('./data/cards.json'),
        collections: require('./data/collections.json'),
        bannedwords: ['loli', 'shouta'],
        promos: require('./data/promos.json'),
        boosts: require('./data/boosts.json')
    }

    console.log(`Working with ${data.cards.length} cards and ${data.collections.length} collections`)

    const options  = Object.assign({shards: 1, data}, config)
    const amusement = child.fork('./', {env: options})

    amusement.send({startup: options})

    amusement.on("message", (msg) => {
        if (msg.info) console.log(msg.info)
        if (msg.error) console.error(msg.error)
    })
}

main().catch(console.error)
