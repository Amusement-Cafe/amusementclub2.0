/* functions */


const byAlias = (ctx, name) => {
    const regex = new RegExp(name, 'gi')
    return ctx.collections.filter(x => x.aliases.some(y => regex.test(y)))
}

const bestColMatch = (ctx, name) => {
	const c = byAlias(ctx, name)
	return c.sort((a, b) => a.id.length - b.id.length)[0]
}

/*
    To utilize this elsewhere, you'll need to pass it the ctx, user, and full card(ctx.cards[card.id]).
    userCards is mainly a copy/paste of mapUserCards from module Cards, but it would break on require so I stole it since it's only 1 line
 */
const completed = async (ctx, user, card) => {
    const colCards = ctx.cards.filter(x => x.col === card.col && x.level < 5)

    const message = "You just completed the _"+ card.col +"_ collection!\n"+
        "You now have the option to reset this collection in exchange for a clout star. One copy of each card will be consumed if you do. To proceed, type:\n"+
        "`->col reset "+ card.col +"`"

    let userCards = user.cards.filter(x => x.id < ctx.cards.length).map(x => Object.assign({}, ctx.cards[x.id], x)).filter(x => x.col === card.col && x.level < 5)
    
    if(userCards.length < colCards.length) {
        return false
    }

    const completedCol = user.completedcols.find(x => x.id === card.col)

    if (!completedCol) {
        await ctx.direct(user, message)
        user.completedcols.push({ id: card.col, notified: true })
        user.markModified('completedcols')
    }
    else {
        if (!completedCol.notified) {
            await ctx.direct(user, message)
            completedCol.notified = true
            user.markModified('completedcols')
        }
    }
    return
}

const reset = async (ctx, user, col) => {
    const completed = user.completedcols.find(x => x.id === col.id)
    const legendary = ctx.cards.find(x => x.col === col.id && x.level === 5)

    if(completed) {
        completed.amount++
        completed.notified = false
    }
    else {
        user.completedcols.push({id: col.id, amount: 1})
    }
    user.markModified('completedcols')

    user.cards.map(x => { 
        if(ctx.cards[x.id] && ctx.cards[x.id].col === col.id && ctx.cards[x.id].level < 5) 
            x.amount--
    })

    user.xp += ctx.cards.filter(x => x.col === col.id && x.level != 5).length
    user.cards = user.cards.filter(x => x.amount > 0)
    user.markModified('cards')

    if(legendary)
        user.inventory.push({ id: 'legendticket', time: new Date(), col: col.id })

    await user.save()

    return ctx.reply(user, `you successfully reset **${col.name}**!
        ${legendary? `Legendary card ticket was added to your inventory. Use it to draw **${col.id} legendary card**!` : ''}`)
}



module.exports = {
    byAlias,
    bestColMatch,
    completed,
    reset
}
