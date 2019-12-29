const {
    cap,
    claimCost, 
    tryGetUserID,
    nameSort
} = require('../utils/tools')

const { bestColMatch }    = require('./collection')

const formatName = (x) => {
    return `[${new Array(x.level + 1).join('★')}] [${cap(x.name.replace(/_/g, ' '))}](${x.shorturl}) \`[${x.col}]\``
}

const formatLink = (x) => {
    return x.url
}

const parseArgs = (ctx, args) => {
    const date = new Date()
    date.setDate(date.getDate() - 1)
    const cols = [], levels = [], keywords = []
    const q = { 
        id: false, 
        sort: (a, b) => b.level - a.level,
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
                case '<name': q.sort = (a, b) => nameSort(a, b); break
                case '>name': q.sort = (a, b) => nameSort(a, b) * -1; break
                case '<star': q.sort = (a, b) => a.level - b.level; break
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
                    else cols.push(bestColMatch(ctx, substr).id)
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

const equals = (card1, card2) => {
    return card1.name === card2.name && card1.level === card2.level && card1.col === card2.col
}

const addUserCard = (user, cardID) => {
    const userCard = user.cards.filter(x => x.id == cardID)[0]
    if(userCard) {
        user.cards[user.cards.findIndex(x => x.id == cardID)].amount++
        user.markModified('cards')

    } else user.cards.push({ id: cardID, amount: 1, obtained: new Date() });
}

const removeUserCard = (user, cardID) => {
    const userCard = user.cards.filter(x => x.id == cardID)[0]
    if(userCard.amount > 1){
        user.cards[user.cards.findIndex(x => x.id == cardID)].amount--
        user.markModified('cards')

    } else user.cards = user.cards.filter(x => x.id != cardID)
}

const mapUserCards = (ctx, user) => {
    return user.cards.map(card => Object.assign({}, ctx.cards[card.id], card))
}

/**
 * Helper function to enrich the comamnd with user cards
 * @param  {Function} callback command handler
 * @return {Promise}
 */
const withCards = (callback) => async (ctx, user, ...args) => {
    const parsedargs = parseArgs(ctx, args)

    /* join user cards to actual card types */
    const map = mapUserCards(ctx, user)
    const cards = filter(map, parsedargs).sort(parsedargs.sort)

    if(cards.length == 0)
        return ctx.reply(user, `no cards found`, 'red')

    return callback(ctx, user, cards, parsedargs, args)
}

/**
 * Helper function to enrich the comamnd with selected card
 * @param  {Function} callback command handler
 * @return {Promise}
 */
const withGlobalCards = (callback) => async(ctx, user, ...args) => {
    const parsedargs = parseArgs(ctx, args)
    const cards = filter(ctx.cards, parsedargs).sort(parsedargs.sort)

    if(cards.length == 0)
        return ctx.reply(user, `card wasn't found`, 'red')

    return callback(ctx, user, cards, parsedargs, args)
}

const bestMatch = cards => cards.sort((a, b) => a.name.length - b.name.length)[0]

module.exports = {
    formatName,
    formatLink,
    equals,
    bestMatch,
    addUserCard,
    removeUserCard,
    filter,
    parseArgs,
    withCards,
    withGlobalCards,
    mapUserCards
}
