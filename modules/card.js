const {Card, Collection}    = require('../collections')
const {cap, claimCost}      = require('../utils/tools')
const colMod                = require('./collection')
const userMod               = require('./user')

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

const parseArgs = (args) => {
    const date = new Date()
    date.setDate(date.getDate() - 1)
    const cols = [], levels = [], keywords = []
    const q = { 
        id: false, 
        sort: (a, b) => a.length - b.length,
        filters: [],
        tags: []
    }

    args.map(x => {
        let substr = x.substr(1)
        q.id = q.id || tryGetUserID(x)
        if(x[0] === '<' || x[0] === '>') {
            switch(x) {
                case '<date': q.sort = (a, b) => a.obtained - b.obtained; break
                case '>date': q.sort = (a, b) => b.obtained - a.obtained; break
                case '>star': q.sort = (a, b) => b.length - a.length; break
            }
        } else if(x[0] === '-' || x[0] === '!') {
            //let m = x[0] === '-'
            switch(substr) {
                case 'gif': q.filters.push(c => c.animated = true); break
                case 'multi': q.filters.push(c => c.amount > 1); break
                case 'fav': q.filters.push(c => c.fav = true); break
                case 'new': q.filters.push(c => c.obtained > date); break
                default: {
                    if(parseInt(substr)) levels.push(parseInt(substr))
                    else cols.push(substr)
                }
            }
        } else if(x[0] === '#') {
            q.tags.push(substr)
        } else {
            keywords.push(x)
        }
    })

    if(cols.length > 0) q.filters.push(c => cols.includes(c.col))
    if(levels.length > 0) q.filters.push(c => levels.includes(c.level))
    if(keywords.length > 0) 
        q.filters.push(c => (new RegExp(`(_|^)${keywords.join('_')}`, 'gi')).test(c.name))

    return q
}

const filter = (cards, query) => {
    query.filters.map(f => cards = cards.filter(f))
    return cards
}

const tryGetUserID = (inp) => {
    inp = inp.trim()

    try {
        if (/^\d+$/.test(inp) && inp > (1000 * 60 * 60 * 24 * 30 * 2 ** 22)){
            return inp;
        } else {
            return inp.slice(0, -1).split('@')[1].replace('!', '');
        }
    }
    catch(err) { }

    return false
}

const userHasCard = (user, card) => {
    return user.cards.filter(x => equals(x, card))[0]
}

const equals = (card1, card2) => {
    return card1.name === card2.name && card1.level === card2.level
}

/*const getUserCard = async (user, args) => {
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
}*/

const addUserCard = (user, cardID) => {
    const userCard = user.cards.filter(x => x.id == cardID)[0]
    if(userCard >= 0) user.cards[userCard].amount++
    else user.cards.push({ id: cardID, amount: 1, obtained: new Date() });
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
    formatClaim,
    formatName,
    formatLink,
    userHasCard,
    equals,
    //getUserCard,
    addUserCard,
    cardIndex,
    withCard,
    filter,
    parseArgs
}
