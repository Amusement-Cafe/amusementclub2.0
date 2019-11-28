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
                case 'gif': q.animated = pos; break
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
    return q;
}

const getUserCards = (user, args) => {
    let res = user.cards
    args.map(x => {
        const sub = x.substr(1)
        const pos = x[0] == '-'
        switch(sub) {
            case 'multi': res = pos? res.filter(c => c.amount > 1) : res.filter(c => !c.amount || c.amount == 1); break
            case 'fav': res = pos? res.filter(c => c.fav) : res.filter(c => !c.fav); break
            //case 'new': q.obtained = pos? {$gt: date} : {$lt: date}; break
        }
    })
    return res
}

const userHasCard = (user, card) => {
    return user.cards.filter(x => equals(x, card))[0]
}

const equals = (card1, card2) => {
    return card1.name === card2.name && card1.level === card2.level
}

const getUserCard = async (user, args) => {
    const req = await parseArgs(args)
    const match = await Card.find(req)
    if(!match[0])
        return 0

    const userFilter = getUserCards(user, args)
    const userMatch = match.filter(x => userFilter.filter(c => equals(c, x)).length > 0)
    if(!userMatch[0])
        return match.length

    const final = userMatch.sort((a, b) => a.length - b.length)[0]
    const userFinal = userFilter.filter(x => equals(x, final))[0]

    for (let attrname in userFinal) { final[attrname] = userFinal[attrname] }
    return final
}

const addUserCard = (user, card) => {
    const userCard = userHasCard(user, card)
    if(userCard) userCard.amount = (userCard.amount + 1 || 2);
    else user.cards.push({ name: card.name, level: card.level, col: card.col, amount: 1 });
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
        const q = { col: (await colMod.fetchRandom(countCol)).id }
        const countCard = await Card.countDocuments(q)
        const item = await fetchRandom(countCard, q)
        addUserCard(user, item)
        items.push(item)
    }

    await user.save()
    return ctx.reply(user, formatClaim(items))
})

cmd(['claim', 'promo'], async (ctx, user, arg1) => {
    const items = await fetchRandom({ isPromo: true }, parseInt(arg1) || 1)

    return ctx.reply(user, items.join('\n'))
})

cmd('sum', async (ctx, user, ...args) => {
    let card = {}
    if(args.length == 0)
        card = user.cards[0]
    else card = await getUserCard(user, args)

    if(!card || card === 0)
        return ctx.reply(user, `card with name **${args.join(' ')}** was not found`)

    if(parseInt(card))
        return ctx.reply(user, `got **${parseInt(card)}** results. You have none of those cards`)

    return ctx.reply(user, {
        url: formatLink(card),
        description: `summons **${formatName(card)}**`
    })
});
