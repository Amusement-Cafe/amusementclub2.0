const {pcmd} = require('../utils/cmd')
const {
    formatName,
    addUserCard,
    withGlobalCard,
    bestMatch,
    equals
} = require('../modules/card')

const {fetchOnly} = require('../modules/user')

pcmd(['admin', 'mod'], ['admin', 'award'], (ctx, user) => {
    
})

pcmd(['admin', 'mod'], ['admin', 'addcard'], withGlobalCard(async (ctx, user, card, parsedargs) => {
    if(!parsedargs.id)
        return ctx.reply(user, `please specify user ID`, 'red')

    const target = await fetchOnly(ctx, parsedargs.id)

    if(!target)
        return ctx.reply(user, `cannot find user with that ID`, 'red')

    addUserCard(user, ctx.cards.findIndex(x => equals(x, card)))
    await user.save()

    return ctx.reply(user, `added ${formatName(card)} to **${target.username}**`)
}))
