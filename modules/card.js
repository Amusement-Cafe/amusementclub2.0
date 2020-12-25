const {
    cap,
    tryGetUserID,
    nameSort,
    escapeRegex
} = require('../utils/tools')

const { 
    Cardinfo 
} = require('../collections')

const { 
    bestColMatch, 
    bestColMatchMulti 
} = require('./collection')

const { 
    fetchTaggedCards 
} = require('./tag')

const asdate = require('add-subtract-date')

const promoRarity = {
    halloween: '🎃',
    christmas: '❄',
    valentine: '🍫',
    birthday: '🎂',
    halloween18: '🍬',
    christmas18: '🎄',
    valentine19: '💗',
    halloween19: '👻',
    christmas19: '☃️',
    birthday20: '🎈',
    christmas20: '🎁',
}

const formatName = (x) => {
    const promo = promoRarity[x.col]
    const rarity = promo? `\`${new Array(x.level + 1).join(promo)}\`` : new Array(x.level + 1).join('★')
    return `[${rarity}]${x.fav? ' `❤` ' : ' '}[${cap(x.name.replace(/_/g, ' '))}](${x.shorturl}) \`[${x.col}]\``
    //return `[${new Array(x.level + 1).join('★')}]${x.fav? ' `❤` ' : ' '}[${cap(x.name.replace(/_/g, ' '))}](${x.shorturl}) \`[${x.col}]\``
}

const parseArgs = (ctx, args, lastdaily) => {
    lastdaily = lastdaily || asdate.subtract(new Date(), 1, 'day')
    
    const cols = [], levels = [], keywords = []
    const anticols = [], antilevels = []
    const q = { 
        ids: [], 
        sort: (a, b) => b.level - a.level,
        filters: [],
        tags: [],
        antitags: [],
        extra: [],
        lastcard: false,
        diff: false,
        me: false,
        bid: 0,
        fav: false,
        userQuery: false,
    }

    args.map(x => {
        let substr = x.substr(1)

        if(x === '.') {
            q.lastcard = true

        } else if((x[0] === '<' || x[0] === '>' || x[0] === '=' || x[0] === '\\') && x[1] != '@') {
            switch(x) {
                case '<date': q.sort = (a, b) => a.obtained - b.obtained; q.userQuery = true; break
                case '>date': q.sort = (a, b) => b.obtained - a.obtained; q.userQuery = true; break
                case '<amount': q.sort = (a, b) => a.amount - b.amount; break
                case '>amount': q.sort = (a, b) => b.amount - a.amount; break
                case '<name': q.sort = (a, b) => nameSort(a, b); break
                case '>name': q.sort = (a, b) => nameSort(a, b) * -1; break
                case '<star': q.sort = (a, b) => a.level - b.level; break
                case '>star': q.sort = (a, b) => b.level - a.level; break
                case '<rating': 
                    q.sort = (a, b) => (a.rating || 0) - (b.rating || 0)
                    q.userQuery = true
                    break
                case '>rating': 
                    q.sort = (a, b) => (b.rating || 0) - (a.rating || 0)
                    q.userQuery = true
                    break
                
                default: {
                    const eq = x[1] === '='
                    eq? substr = x.substr(2): substr
                    const escHeart = x[0] === '\\'
                    if (escHeart && x[1] === '<') {
                        x = x.substr(1)
                        substr = x.substr(1)
                    }
                    switch(x[0]) {
                        case '>' : q.filters.push(c => eq? c.amount >= substr: c.amount > substr); q.userQuery = true; break
                        case '<' : q.filters.push(c => eq? c.amount <= substr: c.amount < substr); q.userQuery = true; break
                        case '=' : q.filters.push(c => c.amount == substr); q.userQuery = true; break
                    }

                }
            }
        } else if(x[0] === '-' || x[0] === '!') {
            if(x[0] === '!' && x[1] === '#') {
                q.antitags.push(substr.substr(1))
            } else {
                const m = x[0] === '-'
                const mcol = bestColMatchMulti(ctx, substr)
                switch(substr) {
                    case 'gif': q.filters.push(c => c.animated == m); break
                    case 'multi': q.filters.push(c => m? c.amount > 1 : c.amount === 1); q.userQuery = true; break
                    case 'fav': q.filters.push(c => m? c.fav : !c.fav); m? q.fav = true: q.fav; q.userQuery = true; break
                    case 'new': q.filters.push(c => m? c.obtained > lastdaily : c.obtained <= lastdaily); q.userQuery = true; break
                    case 'rated': q.filters.push(c => m? c.rating: !c.rating); break
                    case 'promo': m? mcol.map(x=> cols.push(x.id)): mcol.map(x=> anticols.push(x.id)); break
                    case 'diff': q.diff = m; break
                    case 'miss': q.diff = m; break
                    case 'me': q.me = m; break
                    case 'bid': q.bid = m? 1 : 2; break
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
            }
        } else if(x[0] === '#') {
            q.tags.push(substr.replace(/[^\w]/gi, ''))
        } else if(x[0] === ':') {
            q.extra.push(substr)
        } else {
            const tryid = tryGetUserID(x)
            if(tryid) q.ids.push(tryid)
            else keywords.push(x)
        }
    })

    if(cols.length > 0) q.filters.push(c => cols.includes(c.col))
    if(levels.length > 0) q.filters.push(c => levels.includes(c.level))
    if(anticols.length > 0) q.filters.push(c => !anticols.includes(c.col))
    if(antilevels.length > 0) q.filters.push(c => !antilevels.includes(c.level))
    if(keywords.length > 0) 
        q.filters.push(c => (new RegExp(`(_|^)${keywords.map(k => escapeRegex(k)).join('.*')}`, 'gi')).test(c.name))

    q.isEmpty = (usetag = true) => {
        return !q.ids[0] && !q.lastcard && !q.filters[0] && !((q.tags[0] || q.antitags[0]) && usetag)
    }

    return q
}

const filter = (cards, query) => {
    query.filters.map(f => cards = cards.filter(f))
    //return cards.sort(nameSort)
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
    const card = user.cards[matched]
    user.cards[matched].amount--
    user.cards = user.cards.filter(x => x.amount > 0)
    user.markModified('cards')

    if(card.amount === 0 && card.rating) {
        console.log("calling remove rating")
        removeRating(cardID, card.rating)
    }

    return user.cards[matched]? user.cards[matched].amount : 0
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
    if(user.cards.length == 0)
        return ctx.reply(user, `you don't have any cards. Get some using \`${ctx.prefix}claim\``, 'red')

    const parsedargs = parseArgs(ctx, args, user.lastdaily)
    const map = mapUserCards(ctx, user)
    let cards = filter(map, parsedargs)

    if(parsedargs.tags.length > 0) {
        const tgcards = await fetchTaggedCards(parsedargs.tags)
        cards = cards.filter(x => tgcards.includes(x.id))
    }

    if(parsedargs.antitags.length > 0) {
        const tgcards = await fetchTaggedCards(parsedargs.antitags)
        cards = cards.filter(x => !tgcards.includes(x.id))
    }

    if(parsedargs.lastcard)
        cards = map.filter(x => x.id === user.lastcard)

    if(cards.length == 0)
        return ctx.reply(user, `no cards found matching \`${args.join(' ')}\``, 'red')

    if(!parsedargs.lastcard && cards.length > 0) {
        user.lastcard = bestMatch(cards).id
        await user.save()
    }

    cards.sort(parsedargs.sort)
    return callback(ctx, user, cards, parsedargs, args)
}

/**
 * Helper function to enrich the comamnd with selected card
 * @param  {Function} callback command handler
 * @return {Promise}
 */
const withGlobalCards = (callback) => async(ctx, user, ...args) => {
    const parsedargs = parseArgs(ctx, args)
    let allcards
    if(parsedargs.userQuery)
        allcards = mapUserCards(ctx, user)
    else 
        allcards = ctx.cards.slice()

    let cards = filter(allcards, parsedargs)
    if(parsedargs.tags.length > 0) {
        const tgcards = await fetchTaggedCards(parsedargs.tags)
        cards = cards.filter(x => tgcards.includes(x.id))
    }

    if(parsedargs.antitags.length > 0) {
        const tgcards = await fetchTaggedCards(parsedargs.antitags)
        cards = cards.filter(x => !tgcards.includes(x.id))
    }

    if(parsedargs.diff) 
        cards = cards.filter(x => !user.cards.some(y => y.id === x.id))

    if(parsedargs.lastcard)
        cards = [ctx.cards[user.lastcard]]

    if(cards.length == 0)
        return ctx.reply(user, `no cards found matching \`${args.join(' ')}\``, 'red')

    cards.sort(parsedargs.sort)
    return callback(ctx, user, cards, parsedargs, args)
}

/**
 * Helper function to enrich the comamnd with user cards
 * @param  {Function} callback command handler
 * @return {Promise}
 */
const withMultiQuery = (callback) => async (ctx, user, ...args) => {
    const argsplit = args.join(' ').split(',').map(x => x.trim())
    const parsedargs = [], cards = []
    argsplit.map(x => parsedargs.push(parseArgs(ctx, x.split(' '), user.lastdaily)))

    if(!parsedargs[0] || parsedargs[0].isEmpty())
        return ctx.reply(user, `please specify at least one card query`, 'red')

    const map = mapUserCards(ctx, user)
    try {
        await Promise.all(parsedargs.map(async (x, i) => {
            if(x.lastcard)
                cards.push(map.filter(x => x.id === user.lastcard))
            else {
                cards.push(filter(map, x).sort(x.sort))

                if(x.tags.length > 0) {
                    const tgcards = await fetchTaggedCards(x.tags)
                    cards[i] = cards[i].filter(x => tgcards.includes(x.id))
                }

                if(x.antitags.length > 0) {
                    const tgcards = await fetchTaggedCards(x.antitags)
                    cards = cards.filter(x => !tgcards.includes(x.id))
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

const fetchInfo = async (id) => {
    let info = await Cardinfo.findOne({id})
    info = info || (await new Cardinfo())
    info.id = id
    return info
}

const removeRating = async (id, rating) => {
    console.log(`removing rating ${id} ${rating}`)
    const info = await Cardinfo.findOne({id})
    info.ratingsum -= rating
    info.usercount--
    await info.save()
    
}

module.exports = Object.assign(module.exports, {
    formatName,
    equals,
    bestMatch,
    addUserCard,
    removeUserCard,
    filter,
    parseArgs,
    withCards,
    withGlobalCards,
    mapUserCards,
    withMultiQuery,
    fetchInfo,
    removeRating,
})
