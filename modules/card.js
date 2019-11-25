/* functions */

const Card      = require('../collections/card')
const config    = require('../config')
const {cap}     = require('../utils/tools')

const fetchRandom = async (query = {}, amount = 1) => {
    const count = await Card.countDocuments()
    const cards = []

    for (let i = 0; i < amount; i++) {
        let random = Math.floor(Math.random() * count)
        let card = await Card.findOne(query).skip(random)
        cards.push(card)
    }

    return cards
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

module.exports = {
    fetchRandom,
}

/* commands */

const {cmd} = require('../utils/cmd')

cmd('claim', async (ctx, user, arg1) => {
    const items = await fetchRandom({}, parseInt(arg1) || 1)

    return ctx.reply(user, formatClaim(items))
})

cmd('claim', 'promo', async (ctx, user, arg1) => {
    const items = await fetchRandom({ isPromo: true }, parseInt(arg1) || 1)

    return ctx.reply(user, items.join('\n'))
})
