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

const parseArgs = async (args) => {
    const q = { level: { $nin: [] }, col: { $nin: [] } }
    const keywords = []
    const date = new Date()
    date.setDate(date.getDate() - 1)

    await Promise.all(args.map(async x => {
        if(x[0] != '-' && x[0] != '!') {
            keywords.push(x)
        } else {
            const sub = x.substr(1)
            const pos = x[0] == '-'
            switch(sub) {
                case 'craft': q.craft = pos; break
                case 'multi': q.amount = pos? {$gte: 2} : {$eq: 1}; break
                case 'gif': q.animated = pos; break
                case 'fav': q.fav = pos; break
                case 'new': q.obtained = pos? {$gt: date} : {$lt: date}; break
                default: 
                    if(parseInt(sub))
                        pos? (q.level.$in = q.level.$in || []).push(sub) : q.level.$nin.push(sub)
                    else {
                        const col = await colMod.byName(sub)
                        if(col) (pos? (q.col.$in = q.col.$in || []).push(col.id) : q.col.$nin.push(col.id))
                    }
                    break
            }
        }
    }))

    if(keywords.length > 0)
        q.name = new RegExp(`(_|^)${keywords.join('_')}`, 'gi')
    console.log(q)
    return q;
}

const userHasCard = (user, card) => {
    return user.cards.filter(x => equals(x, card)).length > 0
}

const equals = (card1, card2) => {
    return card1.name === card2.name && card1.level === card2.level
}

const getUserCard = async (user, args) => {
    const req = await parseArgs(args)
    const match = await Card.find(req)
    if(!match[0])
        return 0

    const userMatch = match.filter(x =>  userHasCard(user, x))
    if(!userMatch[0])
        return match.length

    const final = userMatch.sort((a, b) => a.length - b.length)[0]
    const userFinal = user.cards.filter(x => equals(x, final))[0]

    for (let attrname in userFinal) { final[attrname] = userFinal[attrname] }
    return final
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
    const card = await getUserCard(user, args)
    console.log(card)

    if(!card || card === 0)
        return ctx.reply(user, `card with name **${args.join(' ')}** was not found`)

    if(parseInt(card))
        return ctx.reply(user, `got **${parseInt(card)}** results. You have none of those cards`)

    return ctx.reply(user, {
        url: formatLink(card),
        description: `summons **${formatName(card)}**`
    })
});
