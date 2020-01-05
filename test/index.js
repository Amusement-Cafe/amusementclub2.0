const config    = require('./config')
const amusement = require('../index.js')

const main = async () => {
    const data = {
        cards: require('./data/cards.json'),
        collections: require('./data/collections.json'),
        help: require('./data/help.json'),
    }

    const options  = Object.assign({sharded: false, userq: [], data}, config)
    const instance = await amusement.start(options)

    const tick = () => {
        const now = new Date();
        options.userq = options.userq.filter(x => x.expires < now);
    }

    setInterval(tick.bind(this), 1000);

    instance.on('error', err => {
        console.error(err)
    })

    // instance.stop()
}

main().catch(console.error)
