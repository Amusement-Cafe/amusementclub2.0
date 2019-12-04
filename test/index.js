const config    = require('./config')
const amusement = require('../index.js')

const main = async () => {
    const data = {
        cards: require('./data/cards.json'),
        collections: require('./data/collections.json'),
    }

    const options  = Object.assign({sharded: false, data}, config)
    const instance = await amusement.start(options)

    instance.on('error', err => {
        console.error(err)
    })

    // instance.stop()
}

main().catch(console.error)
