module.exports = [
    {
        id: 'claimcard',
        name: 'More cards!',
        desc: 'Claim your first card',
        actions: ['claim', 'cl'],
        check: (ctx, user) => user.cards.length > 0,
        resolve: (ctx, user) => {
            user.exp += 200
            return `**200** ${ctx.symbols.tomato}`
        }
    }
]