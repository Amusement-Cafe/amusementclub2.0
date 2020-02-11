/* functions */

const byAlias = (ctx, name) => {
    const regex = new RegExp(name, 'gi')
    return ctx.collections.filter(x => x.aliases.filter(y => regex.test(y))[0])
}

const bestColMatch = (ctx, name) => {
	const c = byAlias(ctx, name)
	return c.sort((a, b) => a.id.length - b.id.length)[0]
}

const reset = async (ctx, user, col) => {
    const completed = user.completedcols.filter(x => x.id === col.id)[0]
    const legendary = ctx.cards.filter(x => x.col === col.id && x.level === 5)[0]

    if(completed)
        completed.amount++
    else
        user.completedcols.push({ id: col.id, amount: 1 })
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
    reset
}
