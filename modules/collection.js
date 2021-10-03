/* functions */


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

/*
    To utilize this elsewhere, you'll need to pass it the ctx, user, and full card(ctx.cards[card.id]).
    userCards is mainly a copy/paste of mapUserCards from module Cards, but it would break on require so I stole it since it's only 1 line
 */
const completed = async (ctx, user, card) => {
    const legendary = ctx.cards.some(x => x.col === card.col && x.level === 5)
    const colCards = ctx.cards.filter(x => x.col === card.col && x.level < 5)
    const preCompleted = user.completedcols.find(x => x.id === card.col)
    const userCards = user.cards.filter(x => x.id < ctx.cards.length).map(x => Object.assign({}, ctx.cards[x.id], x)).filter(x => x.col === card.col && x.level < 5)
    let msg

    if (!preCompleted && userCards.length < colCards.length)
        return

    if (preCompleted && preCompleted.amount) {
        if (preCompleted.amount !== 0 && !user.cloutedcols.some(x => x.id === card.col))
            user.cloutedcols.push({id: card.col, amount: preCompleted.amount})
        preCompleted.amount = 0
        user.markModified('completedcols')
    }


    if (preCompleted && userCards.length < colCards.length){
        msg = `you no longer have all of the cards required for full completion of **${card.col}**! This collection has now been removed from your completed list.`
        user.completedcols = user.completedcols.filter(x => x.id !== card.col)
    }

    if (!preCompleted && userCards.length >= colCards.length) {
        msg = `You have just completed the **${card.col}** collection! 
        You can now decide if you want to reset the collection for a clout star ${legendary? 'and a legendary ticket to claim a legendary card from this collection!': '.'}
        One copy of each card below 5 stars will be consumed if the collection has 200 or fewer cards. Otherwise 200 specified cards will be taken based on overall card composition.
        To reset type:
        \`->col reset ${card.col}\``
        user.completedcols.push({id: card.col})
    }

    if(user.prefs.notifications.completed && msg) {
        try {
            await ctx.direct(user, msg)
        } catch (e) {}
    }
}

const reset = async (ctx, user, col, amounts) => {
    const clouted = user.cloutedcols.find(x => x.id === col.id)
    const legendary = ctx.cards.find(x => x.col === col.id && x.level === 5)

    if(clouted)
        clouted.amount = clouted.amount + 1 || 1
    else
        user.cloutedcols.push({id: col.id, amount: 1})

    user.markModified('cloutedcols')
    let emptyCard
    user.cards.map(x => {
        const exists = ctx.cards[x.id]
        if (!exists)
            return false
        const level = ctx.cards[x.id].level
        const notLegendary = level < 5
        const isCol = ctx.cards[x.id].col === col.id
        const reducable = amounts[level] > 0
        const singleFav = x.fav && x.amount === 1

        if(notLegendary && isCol && exists && reducable && !singleFav) {
            x.amount--
            amounts[level]--
        }
        if (x.amount === 0) {
            emptyCard = x
        }
    })

    user.xp += amounts.total
    user.cards = user.cards.filter(x => x.amount > 0)
    if(emptyCard)
        await completed(ctx, user, ctx.cards[emptyCard.id])
    user.markModified('cards')

    if(legendary)
        user.inventory.push({ id: 'legendticket', time: new Date(), col: col.id })

    await user.save()

    return ctx.reply(user, `you successfully reset **${col.name}**!
        ${legendary? `Legendary card ticket was added to your inventory. Use it to draw **${col.id} legendary card**!` : ''}`)
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
}
