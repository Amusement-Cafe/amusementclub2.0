const {pcmd} = require('../utils/cmd')

const {
    messageLift
} = require('../modules/audit')

const {
    onUsersFromArgs
} = require('../modules/user')

const {
    byAlias
} = require('../modules/collection')

const {
    checkGuildLoyalty,
    get_hero,
    getGuildScore
} = require('../modules/hero')

const {
    formatName,
    addUserCard,
    withGlobalCards,
    bestMatch,
} = require('../modules/card')

const {fetchOnly} = require('../modules/user')
const colors = require('../utils/colors')

pcmd(['admin'], ['sudo', 'add', 'role'], async (ctx, user, ...args) => {
    const rpl = ['']

    await onUsersFromArgs(args, async (target, newargs) => {
        const role = newargs[0]
        if(!target.roles)
            target.roles = []

        if(!role)
            return ctx.reply(user, `this command requires role`, 'red')

        if(target.roles.find(x => x === role))
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

        if(!target.roles || !target.roles.find(x => x === role))
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

    var target = await fetchOnly(parsedargs.ids[0])

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

pcmd(['admin'], ['sudo', 'guild', 'herocheck'], async (ctx, user) => {
    await checkGuildLoyalty(ctx)
    return ctx.reply(user, `current guild hero check done`)
})

pcmd(['admin'], ['sudo', 'hero', 'score'], async (ctx, user, arg) => {
    const hero = await get_hero(ctx, arg)
    if(!hero)
        return ctx.reply(user, `cannot find hero with ID '${arg}'`, 'red')

    const score = await getGuildScore(ctx, ctx.guild, hero.id)
    return ctx.reply(user, `${hero.name} has **${Math.round(score)}** points in current guild`)
})

pcmd(['admin'], ['sudo', 'sum'], withGlobalCards(async (ctx, user, cards, parsedargs, args) => {
    const card = parsedargs.isEmpty()? _.sample(cards) : bestMatch(cards)

    return ctx.reply(user, {
        image: { url: card.url },
        color: colors.blue,
        description: `summons **${formatName(card)}**!`
    })
}))

pcmd(['admin'], ['sudo', 'crash'], (ctx) => {
    throw `This is a test exception`
})

pcmd(['admin'], ['sudo', 'embargo'], async (ctx, user, ...args) => {
    let lift
    const rpl = ['']
    await onUsersFromArgs(args, async (target, newargs) => {
        newargs[0] == 'lift'? lift = true: lift = false
        if(lift) {
            target.ban.embargo = false
            rpl.push(`${target.username} has been lifted`)
            await target.save()
            try {
                await ctx.direct(target, "Your embargo has been lifted, you may now return to normal bot usage. Please try to follow the rules, they can easily be found at \`->rules\`")
            } catch(e) {
                rpl.push(`\n ${target.username} doesn't allow PMs from the bot, so a message was not sent`)
            }
        } else {
            target.ban? target.ban.embargo = true: target.ban = {embargo: true}
            rpl.push(`${target.username} has been embargoed`)
            await target.save()
        }
    })

    return ctx.reply(user, rpl.join('\n'))
})

pcmd(['admin'], ['sudo', 'wip'], ['sudo', 'maintenance'], () => {
    ctx.wip = !ctx.wip
    return ctx.reply(user, `maintenance mode is now **${ctx.wip? `ENABLED` : `DISABLED`}**`)
})
