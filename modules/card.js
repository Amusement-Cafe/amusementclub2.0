const {
    cap,
    tryGetUserID,
    nameSort
} = require('../utils/tools')

const { bestColMatch }          = require('./collection')
const { fetchTaggedCards }      = require('./tag')
const asdate                    = require('add-subtract-date')

const formatName = (x) => {
    return `[${new Array(x.level + 1).join('★')}]${x.fav? ' `❤` ' : ' '}[${cap(x.name.replace(/_/g, ' '))}](${x.shorturl}) \`[${x.col}]\``
}

const formatLink = (x) => {
    return x.url
}

const parseArgs = (ctx, args, lastdaily) => {
    lastdaily = lastdaily || asdate.subtract(new Date(), 1, 'day')
    
    const cols = [], levels = [], keywords = []
    const anticols = [], antilevels = []
    const q = { 
        ids: false, 
        sort: (a, b) => b.level - a.level,
        filters: [],
        tags: [],
        extra: [],
        lastcard: false,
        diff: false,
        me: false,
    }

    args.map(x => {
        let substr = x.substr(1)
        q.id = q.id || tryGetUserID(x)
        if(x === '.') {
            q.lastcard = true

        } else if(x[0] === '<' || x[0] === '>') {
            switch(x) {
                case '<date': q.sort = (a, b) => a.obtained - b.obtained; break
                case '>date': q.sort = (a, b) => b.obtained - a.obtained; break
                case '<name': q.sort = (a, b) => nameSort(a, b); break
                case '>name': q.sort = (a, b) => nameSort(a, b) * -1; break
                case '<star': q.sort = (a, b) => a.level - b.level; break
            }
        } else if(x[0] === '-' || x[0] === '!') {
            const m = x[0] === '-'
            switch(substr) {
                case 'gif': q.filters.push(c => c.animated == m); break
                case 'multi': q.filters.push(c => m? c.amount > 1 : c.amount === 1); break
                case 'fav': q.filters.push(c => m? c.fav : !c.fav); break
                case 'new': q.filters.push(c => m? c.obtained > lastdaily : c.obtained <= lastdaily); break
                case 'diff': q.diff = m; break
                case 'me': q.me = m; break
                default: {
                    const pcol = bestColMatch(ctx, substr)
                    if(m) {
                        if(parseInt(substr)) levels.push(parseInt(substr))
                        else if(pcol) cols.push(pcol.id)
                    } else {
                        if(parseInt(substr)) antilevels.push(parseInt(substr))
                        else if(pcol) anticols.push(pcol.id)
                    }
                }
            }
        } else if(x[0] === '#') {
            q.tags.push(substr)
        } else if(x[0] === ':') {
            q.extra.push(substr)
        } else {
            keywords.push(x)
        }
    })

    if(cols.length > 0) q.filters.push(c => cols.includes(c.col))
    if(levels.length > 0) q.filters.push(c => levels.includes(c.level))
    if(anticols.length > 0) q.filters.push(c => !anticols.includes(c.col))
    if(antilevels.length > 0) q.filters.push(c => !antilevels.includes(c.level))
    if(keywords.length > 0) 
        q.filters.push(c => (new RegExp(`(_|^)${keywords.join('_')}`, 'gi')).test(c.name))

    q.isEmpty = (usetag = true) => {
        return !q.ids && !q.lastcard && !q.filters[0] && !(q.tags[0] && usetag)
    }

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
    const matched = user.cards.findIndex(x => x.id == cardID)
    if(matched > -1) {
        user.cards[matched].amount++
        user.markModified('cards')
        return user.cards[matched].amount
    }

    user.cards.push({ id: cardID, amount: 1, obtained: new Date() })
    return 1
}

const removeUserCard = (user, cardID) => {
    const matched = user.cards.findIndex(x => x.id == cardID)
    user.cards[matched].amount--
    user.cards = user.cards.filter(x => x.amount > 0)
    user.markModified('cards')
    return user.cards[matched].amount > 0
}

const mapUserCards = (ctx, user) => {
    return user.cards.filter(x => x.id < ctx.cards.length).map(x => Object.assign({}, ctx.cards[x.id], x))
}

/**
 * Helper function to enrich the comamnd with user cards
 * @param  {Function} callback command handler
 * @return {Promise}
 */
const withCards = (callback) => async (ctx, user, ...args) => {
    const parsedargs = parseArgs(ctx, args, user.lastdaily)

    /* join user cards to actual card types */
    const map = mapUserCards(ctx, user)
    let cards = filter(map, parsedargs).sort(parsedargs.sort)

    if(parsedargs.tags.length > 0) {
        const tgcards = await fetchTaggedCards(parsedargs.tags)
        cards = cards.filter(x => tgcards.includes(x.id))
    }

    if(parsedargs.lastcard)
        cards = map.filter(x => x.id === user.lastcard)

    if(cards.length == 0)
        return ctx.reply(user, `no cards found`, 'red')

    if(!parsedargs.lastcard && cards.length === 1) {
        user.lastcard = cards[0].id
        await user.save()
    }

    return callback(ctx, user, cards, parsedargs, args)
}

/**
 * Helper function to enrich the comamnd with selected card
 * @param  {Function} callback command handler
 * @return {Promise}
 */
const withGlobalCards = (callback) => async(ctx, user, ...args) => {
    const parsedargs = parseArgs(ctx, args)
    let cards = filter(ctx.cards.slice(), parsedargs).sort(parsedargs.sort)

    if(parsedargs.tags.length > 0) {
        const tgcards = await fetchTaggedCards(parsedargs.tags)
        cards = cards.filter(x => tgcards.includes(x.id))
    }

    if(parsedargs.lastcard)
        cards = cards.filter(x => x.id === user.lastcard)

    if(cards.length == 0)
        return ctx.reply(user, `card wasn't found`, 'red')

    return callback(ctx, user, cards, parsedargs, args)
}

/**
 * Helper function to enrich the comamnd with user cards
 * @param  {Function} callback command handler
 * @return {Promise}
 */
const withMultiQuery = (callback) => async (ctx, user, ...args) => {
    const argsplit = args.join(' ').split(',')
    const parsedargs = [], cards = []
    argsplit.map(x => parsedargs.push(parseArgs(ctx, x.split(' '), user.lastdaily)))

    if(!parsedargs[0] || parsedargs[0].isEmpty())
        return ctx.reply(user, `please specify at least one card query`, 'red')

    const map = mapUserCards(ctx, user)
    try {
        await Promise.all(parsedargs.map(async (x, i) => {
            if(parsedargs.lastcard)
                cards.push(map.filter(x => x.id === user.lastcard))
            else {
                cards.push(filter(map, x).sort(x.sort))

                if(x.tags.length > 0) {
                    const tgcards = await fetchTaggedCards(x.tags)
                    cards[i] = cards[i].filter(x => tgcards.includes(x.id))
                }
            }

            if(cards[i].length == 0)
                throw new Error(`${i + 1}`)
        }))
    } catch (e) {
        return ctx.reply(user, `no cards found in request **#${e.message}**`, 'red')
    }

    return callback(ctx, user, cards, parsedargs, args)
}

const bestMatch = cards => cards? cards.sort((a, b) => a.name.length - b.name.length)[0] : undefined

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
    mapUserCards,
    withMultiQuery
}
