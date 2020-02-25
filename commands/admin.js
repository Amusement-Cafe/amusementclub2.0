const {pcmd} = require('../utils/cmd')

const {
    onUsersFromArgs
} = require('../modules/user')

const {
    byAlias
} = require('../modules/collection')

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

pcmd(['admin', 'mod'], ['sudo', 'award'], ['sudo', 'add', 'balance'], async (ctx, user, ...args) => {
    const rpl = ['']

    await onUsersFromArgs(args, async (target, newargs) => {
        const amount = parseInt(newargs[0])

        if(!amount)
            throw new Error(`this command requires award amount`)

        target.exp += amount
        await target.save()
        rpl.push(`\`✅\` added '${amount}' ${ctx.symbols.tomato} to **${target.username}** (${target.discord_id})`)
    })

    return ctx.reply(user, rpl.join('\n'))
})

pcmd(['admin', 'mod'], ['sudo', 'add', 'vials'], async (ctx, user, ...args) => {
    const rpl = ['']

    await onUsersFromArgs(args, async (target, newargs) => {
        const amount = parseInt(newargs[0])

        if(!amount)
            throw new Error(`this command requires award amount`)

        target.vials += amount
        await target.save()
        rpl.push(`\`✅\` added '${amount}' ${ctx.symbols.vial} to **${target.username}** (${target.discord_id})`)
    })

    return ctx.reply(user, rpl.join('\n'))
})

pcmd(['admin', 'mod'], ['sudo', 'add', 'card'], withGlobalCards(async (ctx, user, cards, parsedargs, args) => {
    if(!parsedargs.ids[0])
        throw new Error(`please specify user ID`)

    var target = await fetchOnly(parsedargs.id[0])

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

pcmd(['admin'], ['sudo', 'guild', 'lock'], async (ctx, user, arg1) => {
    const col = byAlias(ctx, arg1)[0]

    if(!col)
        throw new Error(`collection '${arg1}' not found`)

    ctx.guild.overridelock = col.id
    await ctx.guild.save()

    return ctx.reply(user, `current guild was override-locked to **${col.name}** collection`)
})

pcmd(['admin'], ['sudo', 'guild', 'unlock'], async (ctx, user) => {
    ctx.guild.overridelock = ''
    await ctx.guild.save()

    return ctx.reply(user, `guild override lock was removed. Guild locks (if any) will remain active`)
})

pcmd(['admin'], ['sudo', 'daily', 'reset'], async (ctx, user, ...args) => {
    const rpl = ['']

    await onUsersFromArgs(args, async (target, newargs) => {
        target.lastdaily = new Date(0)
        await target.save()
        rpl.push(`\`✅\` daily reset for **${target.username}** (${target.discord_id})`)
    })

    return ctx.reply(user, rpl.join('\n'))
})
