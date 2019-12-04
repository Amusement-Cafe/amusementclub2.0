const {Card, Collection}    = require('../collections')
const {cap, claimCost}      = require('../utils/tools')
const colMod                = require('./collection')
const userMod               = require('./user')

const fetchRandom = async (amount, query = {}) => {
    const random = Math.floor(Math.random() * amount)
    return await Card.findOne(query).skip(random)
}

const formatClaim = (user, cards) => {
    const repl = "you got:\n"
    cards.sort((a, b) => b.level - a.level)
    return {
        url: formatLink(cards[0]),
        description: repl.concat(cards.map(x => formatName(x)).join('\n'))
    }

    repl.concat(`\nYour next claim will cost ${claimCost(user, user.dailystats.claims + 1)}`)
}

const formatName = (x) => {
    return `[${new Array(x.level + 1).join('★')}] [${cap(x.name.replace(/_/g, ' '))}](${formatLink(x)}) \`[${x.col || x.collection}]\``
}

const formatLink = (x) => {
    return x.url
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
    const userCard = cardIndex(user, card)
    if(userCard >= 0) user.cards[userCard].amount = (user.cards[userCard].amount + 1 || 2);
    else user.cards.push({ name: card.name, level: card.level, col: card.col, amount: 1 });
}

const cardIndex = (user, card) => {
    return user.cards.findIndex(x => equals(x, card))
}

/**
 * Helper function to enrich the comamnd with selected card
 * @param  {Function} callback command hanlder
 * @return {Promise}
 */
const withCard = (options, callback) => async (ctx, user, ...args) => {
    let card = {}

    if (options.autoselect && args.length == 0) {
        card = user.cards[0]
    } else {
        card = await getUserCard(user, args)
    }

    if (!card || card === 0)
        return ctx.reply(user, `card **${args.join(' ')}** doesn't exist`)

    if (parseInt(card))
        return ctx.reply(user, `got **${parseInt(card)}** results. You have none of those cards`)

    return callback(ctx, user, card, ...args)
}

module.exports = {
    fetchRandom,
    formatClaim,
    formatName,
    formatLink,
    userHasCard,
    equals,
    getUserCard,
    addUserCard,
    cardIndex,
    withCard,
}
