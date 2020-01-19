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

pcmd(['admin'], ['sudo', 'add', 'role'], async (ctx, user, ...args) => {
    const rpl = ['']

    await onUsersFromArgs(args, async (target, newargs) => {
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

    return ctx.reply(user, rpl.join('\n'))
})

pcmd(['admin'], ['sudo', 'rm', 'role'], async (ctx, user, ...args) => {
    const rpl = ['']

    await onUsersFromArgs(args, async (target, newargs) => {
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

    return ctx.reply(user, rpl.join('\n'))
})

pcmd(['admin', 'mod'], ['sudo', 'award'], async (ctx, user, ...args) => {
    const rpl = ['']

    await onUsersFromArgs(args, async (target, newargs) => {
        const amount = parseInt(newargs[0])

        if(!amount)
            throw new Error(`this command requires award amount`)

        target.exp += amount
        await target.save()
        rpl.push(`\`✅\` added '${amount}' {currency} to **${target.username}** (${target.discord_id})`)
    })

    return ctx.reply(user, rpl.join('\n'))
})

pcmd(['admin', 'mod'], ['sudo', 'add', 'card'], withGlobalCards(async (ctx, user, cards, parsedargs, args) => {
    if(!parsedargs.id)
        throw new Error(`please specify user ID`)

    var target = await fetchOnly(parsedargs.id)

    if(!target)
        throw new Error(`cannot find user with that ID`)

    const card = bestMatch(cards)
    addUserCard(target, card.id)
    await target.save()

    return ctx.reply(user, `added ${formatName(card)} to **${target.username}**`)
}))

pcmd(['admin'], ['sudo', 'stress'], async (ctx, user, ...args) => {
    if(isNaN(args[0]))
        throw new Error(`please specify amount`)

    for(i=0; i<parseInt(args[0]); i++) {
        ctx.reply(user, `test message #${i}`)
    }
})
