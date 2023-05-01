const { 
    countUserCards,
    getUserCards,
    removeUserCards,
} = require('./user')

const _             = require('lodash')
const UserInventory = require("../collections/userInventory")
const Users         = require('../collections/user')

const byAlias = (ctx, name) => {
    const regex = new RegExp(name, 'gi')
    return ctx.collections.filter(x => x.aliases.some(y => regex.test(y)))
}

const bestColMatch = (ctx, name) => {
	const c = byAlias(ctx, name)
	return c.sort((a, b) => a.id.length - b.id.length)[0]
}

const bestColMatchMulti = (ctx, name) => {
    const c = byAlias(ctx, name)
    return c.sort((a, b) => a.id.length - b.id.length)
}


const completed = async (ctx, user, cardIDs) => {
    const fullCards = cardIDs.map(x => ctx.cards[x])
    const uniqueColCards = _.uniqBy(fullCards, 'col')
    let completedCols = []
    let lostCompletion = []
    for (let i = 0; i < uniqueColCards.length; i++) {
        let card = uniqueColCards[i]
        const colCards = ctx.cards.filter(y => y.col === card.col && y.level < 5)
        const preCompleted = user.completedcols.find(y => y.id === card.col)
        const userCardCount = await countUserCards(ctx, user, colCards.map(y => y.id))

        if (!preCompleted && userCardCount < colCards.length)
            continue

        if (preCompleted && preCompleted.amount) {
            if (preCompleted.amount !== 0 && !user.cloutedcols.some(y => y.id === card.col))
                user.cloutedcols.push({id: card.col, amount: preCompleted.amount})
            preCompleted.amount = 0
            user.markModified('completedcols')
        }

        if (preCompleted && userCardCount < colCards.length)
            lostCompletion.push(card.col)

        if (!preCompleted && userCardCount >= colCards.length)
            completedCols.push(card.col)
    }
    if (completedCols.length !== 0) {
        completedCols.map(x => user.completedcols.push({id: x}))
        await user.save()
        if(user.prefs.notifications.completed) {
            try {
                await ctx.direct(user, `you have just completed \`${completedCols.join(', ')}\`!
                You can now decide if you want to reset ${completedCols.length > 1? 'these collections for clout stars and legendary cards if they contain them.': 'this collection for a clout star and a legendary card if it contains one!'}
                One copy of each card below 5 stars will be consumed if the collection has 200 or fewer cards. Otherwise 200 specified cards will be taken based on overall card composition.
                To reset type:
                \`/collection reset collection:collectionName\``)
            } catch (e) {}
        }
    }

    if (lostCompletion.length !== 0) {
        user.completedcols = user.completedcols.filter(x => !lostCompletion.includes(x.id))
        await user.save()
        if(user.prefs.notifications.completed) {
            try {
                await ctx.direct(user, `you no longer have all the cards required for a full completion of \`${lostCompletion.join(', ')}\`. ${lostCompletion.length>1? 'These collections have': 'This collection has'} been removed from your completed list.`)
            } catch (e) {}
        }
    }
}

const updateCompletion = async (ctx, cards, oldCards) => {
    const newCards = cards.filter(x => !oldCards.some(y => y.id === x.id))
    const cols = _.uniqBy(newCards, 'col').map(x => x.col)
    await Promise.all(cols.map(async x => {
        const completedUsers = await Users.find({"completedcols.id": x})
        completedUsers.map(async y => {
            if (y.prefs.notifications.completed) {
                try {
                    await ctx.direct(y, `due to a collection update, you no longer have all the cards required for a full completion of \`${x}\`. 
                    This collection has been removed from your completed list!`, 'red')
                } catch (e) {y.prefs.notifications.completed = false}
            }
            y.completedcols = y.completedcols.filter(z => z.id !== x)
            await y.save()
        })
    }))
}

const reset = async (ctx, user, col, amounts) => {
    const clouted = user.cloutedcols.find(x => x.id === col.id)
    const legendary = ctx.cards.find(x => x.col === col.id && x.level === 5)
    const userCards = await getUserCards(ctx, user)

    if(clouted)
        clouted.amount = clouted.amount + 1 || 1
    else
        user.cloutedcols.push({id: col.id, amount: 1})

    user.markModified('cloutedcols')

    const cardsToRemove = userCards.filter(x => {
        const exists = ctx.cards[x.cardid]
        if (exists) {
            const level = ctx.cards[x.cardid].level
            const notLegendary = level < 5
            const isCol = ctx.cards[x.cardid].col === col.id
            const reducable = amounts[level] > 0
            const singleFav = x.fav && x.amount === 1

            if(notLegendary && isCol && reducable && !singleFav) {
                amounts[level]--
                return true
            }
        }

        return false
    }).map(x => x.cardid)

    if(amounts[1] || amounts[2] || amounts[3] || amounts[4]) {
        return ctx.reply(user, `an error occured while resetting this collection. Please check if you have all cards required.`, 'red')
    }

    user.xp += amounts.total

    await removeUserCards(ctx, user, cardsToRemove)
    await completed(ctx, user, cardsToRemove)

    if(legendary) {
        const ticket = new UserInventory()
        ticket.userid = user.discord_id
        ticket.id = 'legendticket'
        ticket.acquired = new Date()
        ticket.col = col.id
        await ticket.save()
    }

    await user.save()

    return ctx.reply(user, `you successfully reset **${col.name}**!
        ${legendary? `Legendary card ticket was added to your inventory. Use it to draw **${col.id} legendary card**!` : ''}`, 'green', true)
}

const resetNeeds = async (ctx, user, colCards) => {
    const amount = colCards.length
    const fourStars = colCards.filter(x => x.level === 4)
    const threeStars = colCards.filter(x => x.level === 3)
    const twoStars = colCards.filter(x => x.level === 2)
    const oneStars = colCards.filter(x => x.level === 1)
    if (amount < 200) {
        return {
            4: fourStars.length,
            3: threeStars.length,
            2: twoStars.length,
            1: oneStars.length,
            total: amount
        }
    }
    let division = amount / 200
    return {
        4: Math.round(fourStars.length / division),
        3: Math.round(threeStars.length / division),
        2: Math.round(twoStars.length / division),
        1: Math.round(oneStars.length / division),
        total: 200
    }
}

const hasResetNeeds = async (ctx, userCards, needed) => {
    const fourStars = userCards.filter(x => x.level === 4 && (x.fav? x.amount > 1: x.amount > 0)).length >= needed[4]
    const threeStars = userCards.filter(x => x.level === 3 && (x.fav? x.amount > 1: x.amount > 0)).length >= needed[3]
    const twoStars = userCards.filter(x => x.level === 2 && (x.fav? x.amount > 1: x.amount > 0)).length >= needed[2]
    const oneStars = userCards.filter(x => x.level === 1 && (x.fav? x.amount > 1: x.amount > 0)).length >= needed[1]
    return fourStars && threeStars && twoStars && oneStars
}



module.exports = {
    byAlias,
    bestColMatch,
    bestColMatchMulti,
    completed,
    reset,
    resetNeeds,
    hasResetNeeds,
    updateCompletion,
}
