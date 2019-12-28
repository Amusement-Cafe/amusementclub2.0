const {pcmd} = require('../utils/cmd')

const {
    onUsersFromArgs
} = require('../modules/user')

const {
    formatName,
    addUserCard,
    withGlobalCards,
    bestMatch,
    equals
} = require('../modules/card')

const {fetchOnly} = require('../modules/user')

pcmd(['admin'], ['admin', 'add', 'role'], async (ctx, user, ...args) => {
    const rpl = ['']

    const res = await onUsersFromArgs(args, async (target, newargs) => {
        const role = newargs[0]
        if(!target.roles)
            target.roles = []

        if(!role)
            return ctx.reply(user, `this command requires role`, 'red')

        if(target.roles.filter(x => x === role)[0])
            rpl.push(`\`❌\` **${target.username}** (${target.discord_id}) already has role '${role}'`)
        else {
            target.roles.push(role)
            await target.save()
            rpl.push(`\`✅\` added role '${role}' to **${target.username}** (${target.discord_id})`)
        }
    })

    if(res)
        return ctx.reply(user, res, 'red')

     return ctx.reply(user, rpl.join('\n'))
})

pcmd(['admin'], ['admin', 'rm', 'role'], async (ctx, user, ...args) => {
    const rpl = ['']

    const res = await onUsersFromArgs(args, async (target, newargs) => {
        const role = newargs[0]

        if(!role)
            return ctx.reply(user, `this command requires role`, 'red')

        if(!target.roles || !target.roles.filter(x => x === role)[0])
            rpl.push(`\`❌\` **${target.username}** (${target.discord_id}) doesn't have role role '${role}'`)
        else {
            target.roles = target.roles.filter(x => x != role)
            await target.save()
            rpl.push(`\`✅\` removed role '${role}' from **${target.username}** (${target.discord_id})`)
        }
    })

    if(res)
        return ctx.reply(user, res, 'red')

     return ctx.reply(user, rpl.join('\n'))
})

pcmd(['admin', 'mod'], ['admin', 'award'], async (ctx, user, ...args) => {
    const rpl = ['']

    const res = await onUsersFromArgs(args, async (target, newargs) => {
        const amount = parseInt(newargs[0])

        if(!amount)
            return ctx.reply(user, `this command requires award amount`, 'red')

        target.exp += amount
        await target.save()
        rpl.push(`\`✅\` added '${amount}' {currency} to **${target.username}** (${target.discord_id})`)
    })

    if(res)
        return ctx.reply(user, res, 'red')

     return ctx.reply(user, rpl.join('\n'))
})

pcmd(['admin', 'mod'], ['admin', 'add', 'card'], withGlobalCards(async (ctx, user, cards, parsedargs, args) => {
    if(!parsedargs.id)
        return ctx.reply(user, `please specify user ID`, 'red')

    var target = await fetchOnly(parsedargs.id)

    if(!target)
        return ctx.reply(user, `cannot find user with that ID`, 'red')

    const card = bestMatch(cards)
    addUserCard(target, card.id)
    await target.save()

    return ctx.reply(user, `added ${formatName(card)} to **${target.username}**`)
}))
