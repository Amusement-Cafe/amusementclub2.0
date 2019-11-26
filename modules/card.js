/* functions */

const Card          = require('../collections/card')
const Collection    = require('../collections/collection')
const config        = require('../config')
const {cap}         = require('../utils/tools')

const colMod    = require('./collection')

const fetchRandom = async (amount, query = {}) => {
    const random = Math.floor(Math.random() * amount)
    return await Card.findOne(query).skip(random)
}

const formatClaim = (cards) => {
    const repl = "you got:\n"
    cards.sort((a, b) => b.level - a.level)
    return {
        url: formatLink(cards[0]),
        description: repl.concat(cards.map(x => formatName(x)).join('\n'))
    }
}

const formatName = (x) => {
    return `[[${new Array(x.level + 1).join('★')}] ${cap(x.name.replace(/_/g, ' '))} \`[${x.col}]\`](${formatLink(x)})`
}

const formatLink = (x) => {
    return `${config.baseurl}/cards/${x.col}/${x.level}_${x.name}.${x.animated? 'gif' : 'jpg'}`
}

const parseArgs = (args) => {

}

const userHasCard = (user, card) => {
    console.log(card._id)
    console.log(user.cards[0]._id)
    return user.cards.filter(x => x._id == card._id).length > 0
}

module.exports = {
    fetchRandom,
}

/* commands */

const {cmd} = require('../utils/cmd')

cmd('claim', async (ctx, user, arg1) => {
    const countCol = await Collection.countDocuments()
    const items = []
    const amount = parseInt(arg1) || 1

    for (let i = 0; i < amount; i++) {
        const q = { col: (await colMod.fetchRandom(countCol)).name }
        const countCard = await Card.countDocuments(q)
        items.push(await fetchRandom(countCard, q))
    }

    return ctx.reply(user, formatClaim(items))
})

cmd(['claim', 'promo'], async (ctx, user, arg1) => {
    const items = await fetchRandom({ isPromo: true }, parseInt(arg1) || 1)

    return ctx.reply(user, items.join('\n'))
})

cmd('sum', async (ctx, user, ...args) => {
    const regexp = new RegExp("(_|^)" + args.join('_'), 'ig');
    const card = await Card.findOne({ name: regexp })

    if(!card)
        return ctx.reply(user, `card with name **${args.join(' ')}** was not found`)

    //if(!userHasCard(user, card))
        //return ctx.reply(user, `card **${formatName(card)}** exists, but you don't have it`)

    return ctx.reply(user, {
        url: formatLink(card),
        description: `summons **${formatName(card)}**`
    })
});
