/* functions */

const byAlias = (ctx, name) => {
    const regex = new RegExp(name, 'gi')
    return ctx.collections.filter(x => x.aliases.filter(y => regex.test(y))[0])
}

const bestColMatch = (ctx, name) => {
	const c = byAlias(ctx, name)
	return c.sort((a, b) => a.id.length - b.id.length)[0]
}

module.exports = {
    byAlias, 
    bestColMatch
}
