const {pcmd}        = require('../utils/cmd')
const Announcement  = require('../collections/announcement')
const Auction       = require('../collections/auction')
const Transaction   = require('../collections/transaction')
const Users         = require('../collections/user')
const UserCards     = require('../collections/userCard')
const _             = require('lodash')

const {
    getHelpEmbed,
} = require("../commands/misc")

const {
    onUsersFromArgs,
    fetchOnly,
    addUserCards,
    removeUserCards,
    findUserCards,
    getUserCards,
} = require('../modules/user')

const {
    byAlias,
} = require('../modules/collection')

const {
    checkGuildLoyalty,
    get_hero,
    getGuildScore,
} = require('../modules/hero')

const {
    formatName,
    withGlobalCards,
    bestMatch,
} = require('../modules/card')

const {
    fetchInfo,
} = require("../modules/meta")

const {
    evalCard,
    evalCardFast,
} = require("../modules/eval")

const {
    withInteraction,
} = require("../modules/interactions")

const {
    fetchGuildById,
} = require("../modules/guild")

const {
    numFmt,
} = require('../utils/tools')

const colors = require('../utils/colors')

pcmd(['admin'], ['sudo', 'help'], withInteraction(async (ctx, user, ...args) => {
    const help = ctx.audithelp.find(x => x.type === 'admin')
    const curpgn = getHelpEmbed(ctx, help, ctx.guild.prefix)

    return ctx.sendPgn(ctx, user, curpgn)
}))

pcmd(['admin'], ['sudo', 'add', 'role'], withInteraction(async (ctx, user, args) => {
    const rpl = ['']

    await onUsersFromArgs(args, async (target, newargs) => {
        const role = args.role
        if(!target.roles)
            target.roles = []

        if(target.roles.find(x => x === role))
            rpl.push(`\`❌\` **${target.username}** (${target.discord_id}) already has role '${role}'`)
        else {
            target.roles.push(role)
            await target.save()
            rpl.push(`\`✅\` added role '${role}' to **${target.username}** (${target.discord_id})`)
        }
    })

    return ctx.reply(user, rpl.join('\n'))
}))

pcmd(['admin'], ['sudo', 'remove', 'role'], withInteraction(async (ctx, user, args) => {
    const rpl = ['']

    await onUsersFromArgs(args, async (target, newargs) => {
        const role = args.role

        if(!target.roles || !target.roles.find(x => x === role))
            rpl.push(`\`❌\` **${target.username}** (${target.discord_id}) doesn't have role role '${role}'`)
        else {
            target.roles = target.roles.filter(x => x != role)
            await target.save()
            rpl.push(`\`✅\` removed role '${role}' from **${target.username}** (${target.discord_id})`)
        }
    })

    return ctx.reply(user, rpl.join('\n'))
}))

pcmd(['admin'], ['sudo', 'inrole'], withInteraction(async (ctx, user, args) => {
    const inRole = await Users.find({roles: {$ne: [], $in: args}}).sort('username')
    if (inRole.length === 0)
        return ctx.reply(user, `no users found in role(s) **${args.join(' or ')}**`, 'red')
    const pages = []
    inRole.map((x, i) => {
        if (i % 10 == 0) pages.push(``)
        pages[Math.floor(i/10)] += `${x.username} \`${x.discord_id}\` - ${x.roles.join(', ')}\n`
    })
    return ctx.sendPgn(ctx, user, {
        pages,
        buttons: ['first', 'back', 'forward', 'last'],
        embed: {
            author: { name: `List of all users with the role(s) ${args.join(' or ')}` },
            color: colors.blue,
        }
    })
}))

pcmd(['admin', 'mod'],['sudo', 'add', 'tomatoes'], withInteraction(async (ctx, user, args) => {
    const rpl = ['']

    await onUsersFromArgs(args, async (target, newargs) => {
        const amount = args.amount

        if(!amount)
            throw new Error(`this command requires award amount`)

        target.exp += amount
        await target.save()
        rpl.push(`\`✅\` added '${numFmt(amount)}' ${ctx.symbols.tomato} to **${target.username}** (${target.discord_id})`)
    })

    return ctx.reply(user, rpl.join('\n'))
}))

pcmd(['admin', 'mod'], ['sudo', 'add', 'vials'], withInteraction(async (ctx, user, args) => {
    const rpl = ['']

    await onUsersFromArgs(args, async (target, newargs) => {
        const amount = args.amount

        if(!amount)
            throw new Error(`this command requires award amount`)

        target.vials += amount
        await target.save()
        rpl.push(`\`✅\` added '${numFmt(amount)}' ${ctx.symbols.vial} to **${target.username}** (${target.discord_id})`)
    })

    return ctx.reply(user, rpl.join('\n'))
}))

pcmd(['admin', 'mod'], ['sudo', 'add', 'lemons'], withInteraction(async (ctx, user, args) => {
    const rpl = ['']

    await onUsersFromArgs(args, async (target, newargs) => {
        const amount = args.amount

        if(!amount)
            throw new Error(`this command requires award amount`)

        target.lemons += amount
        await target.save()
        rpl.push(`\`✅\` added '${amount}' ${ctx.symbols.lemon} to **${target.username}** (${target.discord_id})`)
    })

    return ctx.reply(user, rpl.join('\n'))
}))

pcmd(['admin', 'mod'], ['sudo', 'add', 'card'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs, args) => {
    if(!parsedargs.ids[0])
        throw new Error(`please specify user ID`)

    const target = await fetchOnly(parsedargs.ids[0]).lean()

    if(!target)
        throw new Error(`cannot find user with that ID`)

    const card = bestMatch(cards)
    await addUserCards(ctx, target, [card.id])

    return ctx.reply(user, `added ${formatName(card)} to **${target.username}**`)
})))

pcmd(['admin', 'mod'], ['sudo', 'add', 'cards'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs, args) => {
    if(!parsedargs.ids[0])
        throw new Error(`please specify user ID`)

    const target = await fetchOnly(parsedargs.ids[0]).lean()

    if(!target)
        throw new Error(`cannot find user with that ID`)

    await addUserCards(ctx, target, cards.map(x => x.id))

    return ctx.reply(user, `added **${cards.length}** cards to **${target.username}**`)
})))

pcmd(['admin', 'mod'], ['sudo', 'remove', 'card'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs, args) => {
    if(!parsedargs.ids[0])
        throw new Error(`please specify user ID`)

    const target = await fetchOnly(parsedargs.ids[0])

    if(!target)
        throw new Error(`cannot find user with that ID`)

    const card = bestMatch(cards)
    await removeUserCards(ctx, target, [card.id])
    await target.save()

    return ctx.reply(user, `removed ${formatName(card)} from **${target.username}**`)
})))

pcmd(['admin'], ['sudo', 'stress'], withInteraction(async (ctx, user, args) => {

    for(let i=0; i < args.amount; i++) {
        ctx.reply(user, `test message #${i}`)
    }
}))

pcmd(['admin'], ['sudo', 'guild', 'lock'], withInteraction(async (ctx, user, args) => {
    if (args.cols.length === 0)
        return ctx.reply(user, `collection \`${args.colQuery}\` not found`, 'red')
    const guild = await fetchGuildById(args.guildID)

    if (!guild)
        return ctx.reply(user, `no guild found with ID \`${args.guildID}\`!`, 'red')

    const col = _.flattenDeep(args.cols)[0]

    guild.overridelock = col.id
    await guild.save()

    return ctx.reply(user, `guild \`${guild.id}\` was override-locked to the **${col.name}** collection`)
}))

pcmd(['admin'], ['sudo', 'guild', 'unlock'], withInteraction(async (ctx, user, args) => {
    const guild = await fetchGuildById(args.guildID)

    if (!guild)
        return ctx.reply(user, `no guild found with ID \`${args.guildID}\`!`, 'red')

    guild.overridelock = ''
    await guild.save()

    return ctx.reply(user, `guild override lock was removed. Guild locks (if any) will remain active`)
}))

pcmd(['admin'], ['sudo', 'reset', 'daily'], withInteraction(async (ctx, user, args) => {
    const rpl = ['']

    await onUsersFromArgs(args, async (target, newargs) => {
        target.lastdaily = new Date(0)
        await target.save()
        rpl.push(`\`✅\` daily reset for **${target.username}** (${target.discord_id})`)
    })

    return ctx.reply(user, rpl.join('\n'))
}))

pcmd(['admin'], ['sudo', 'guild', 'herocheck'], withInteraction(async (ctx, user) => {
    await checkGuildLoyalty(ctx)
    return ctx.reply(user, `current guild hero check done`)
}))

pcmd(['admin'], ['sudo', 'hero', 'score'], withInteraction(async (ctx, user, args) => {
    const hero = await get_hero(ctx, arg)
    if(!hero)
        return ctx.reply(user, `cannot find hero with ID '${arg}'`, 'red')

    const score = await getGuildScore(ctx, ctx.guild, hero.id)
    return ctx.reply(user, `${hero.name} has **${Math.round(score)}** points in current guild`)
}))

pcmd(['admin', 'mod'], ['sudo', 'summon'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs, args) => {
    const card = parsedargs.isEmpty()? _.sample(cards) : bestMatch(cards)

    return ctx.reply(user, {
        image: { url: card.url },
        color: colors.blue,
        description: `summons **${formatName(card)}**!`
    })
})))

pcmd(['admin', 'mod'], ['sudo', 'eval', 'reset'], withInteraction(async (ctx, user, args) => {
    const info = fetchInfo(ctx, args.cardID)
    if (!info)
        return ctx.reply(user, 'card not found!', 'red')
    info.aucevalinfo.newaucprices = []
    info.aucevalinfo.evalprices= []
    info.aucevalinfo.auccount = 0
    info.aucevalinfo.lasttoldeval = -1
    await info.save()
    await evalCard(ctx, ctx.cards[args.cardID])
    return ctx.reply(user, `successfully reset auction based eval for card ${formatName(ctx.cards[args.cardID])}!`)
}))

pcmd(['admin', 'mod'], ['sudo', 'eval', 'info'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs, args) => {
    const info = fetchInfo(ctx, cards[0].id)
    let evalDiff
    let newEval = await evalCardFast(ctx, cards[0])
    let lastEval = info.aucevalinfo.lasttoldeval > 0? info.aucevalinfo.lasttoldeval: newEval



    if (lastEval > newEval)
        evalDiff = `-${numFmt(lastEval - newEval)}`
    else
        evalDiff = `+${numFmt(newEval - lastEval)}`

    let evalPrices = info.aucevalinfo.evalprices.length > 0? info.aucevalinfo.evalprices.join(', '): 'empty'
    let aucPrices = info.aucevalinfo.newaucprices.length > 0? info.aucevalinfo.newaucprices.join(', '): 'empty'
    let pricesEmbed = {
        author: { name: `Eval info for card ${cards[0].name}, ID: ${cards[0].id}` },
        fields: [
            {
                name: "Card Link",
                value: `${formatName(cards[0])}`,
                inline: true
            },
            {
                name: "Currently Used Eval Prices List",
                value: `${evalPrices}`
            },
            {
                name: "Current Auc Prices List",
                value: `${aucPrices}`
            },
            {
                name: "Old Eval",
                value: `${numFmt(lastEval)}`,
                inline: true
            },
            {
                name: "New Eval",
                value: `${numFmt(newEval)}`,
                inline: true
            },
            {
                name: "Eval Diff",
                value: evalDiff,
                inline: true
            }

        ],
        color: colors.green
    }

    await ctx.send(ctx.interaction, pricesEmbed)
})))

pcmd(['admin', 'mod'], ['sudo', 'eval', 'force'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs, args) => {
    return ctx.sendCfm(ctx, user, {
        embed: { footer: { text: `Run \`/sudo eval info\`first to make sure you have the correct card! ` } },
        question: `**${user.username}**, do you want to force waiting auction prices into eval for ${formatName(cards[0])}?`,
        onConfirm: async (x) => {
            const info = fetchInfo(ctx, cards[0].id)
            info.aucevalinfo.newaucprices.map(x => info.aucevalinfo.evalprices.push(x))
            info.aucevalinfo.newaucprices = []
            await info.save()
            return ctx.reply(user, `all awaiting auction prices are now set for eval!`, 'green', true)
        }
    })
})))

pcmd(['admin'], ['sudo', 'reverse', 'transaction'], withInteraction(async (ctx, user, args) => {
    const trans = await Transaction.findOne({id: args.transID})
    if (!trans)
        return ctx.reply(user, `transaction with ID \`${args.transID}\` could not be found!`, 'red')

    const fromUser = await fetchOnly(trans.from_id)
    const toUser = await fetchOnly(trans.to_id)

    if (toUser) {
        const toUserCards = await findUserCards(ctx, toUser, trans.cards)
        if (toUserCards.length !== trans.cards.length)
            return ctx.reply(user, `the user the cards were sold to has already sold or removed some of the cards from their list, reverse cancelled!`, 'red')

        return ctx.sendCfm(ctx, user, {
            question: `Do you want to reverse transaction \`${trans.id}\` **${fromUser.username}** -> **${toUser.username}** consisting of **${trans.cards.length}** cards worth **${trans.price}**?`,
            onConfirm: async () => {
                await removeUserCards(ctx, toUser, trans.cards)
                await addUserCards(ctx, fromUser, trans.cards)
                fromUser.exp -= trans.price
                toUser.exp += trans.price
                await toUser.save()
                await fromUser.save()
                await Transaction.deleteOne({id: args.transID, from_id: fromUser.discord_id})
                return ctx.reply(user, `reversed transaction \`${trans.id}\` **${fromUser.username}** -> **${toUser.username}** consisting of **${trans.cards.length}** cards worth **${trans.price}**`, 'green', true)
            }
        })

    }

    return ctx.sendCfm(ctx, user, {
        question: `Do you want to reverse transaction \`${trans.id}\` for user **${fromUser.username}** consisting of **${trans.cards.length}** cards worth **${trans.price}**?`,
        onConfirm: async () => {
            await addUserCards(ctx, fromUser, trans.cards)
            fromUser.exp -= trans.price
            await fromUser.save()
            await Transaction.deleteOne({id: args.transID, from_id: fromUser.discord_id})
            return ctx.reply(user, `reversed transaction \`${trans.id}\` for **${fromUser.username}** consisting of **${trans.cards.length}** cards worth **${trans.price}**`, 'green', true)
        }
    })
}))

pcmd(['admin'], ['sudo', 'reverse', 'auction'], withInteraction(async (ctx, user, args) => {
    // Todo Add reverse auction here and in adminjson
    // const auction = await Auction.findOne({id: args.aucID, finished: true})
    // if (!auction)
    //     return ctx.reply(user, `auction with ID \`${args.aucID}\` could not be found, or it is not finished yet!`, 'red')

}))

pcmd(['admin'], ['sudo', 'crash'], withInteraction((ctx) => {
    throw `This is a test exception`
}))

pcmd(['admin'], ['sudo', 'refresh', 'global'], withInteraction(async (ctx, user) => {
    await ctx.bot.bulkEditCommands(ctx.slashCmd)
    return ctx.reply(user, `an update of the bot's **GLOBAL** slash commands is currently underway. Please allow for up to 1 hour for the changes to be reflected, the bot may not be usable during this time.`)
}))

pcmd(['admin'], ['sudo', 'refresh', 'admin'], withInteraction(async (ctx, user) => {
    await ctx.bot.bulkEditGuildCommands(ctx.adminGuildID, ctx.adminCmd)
    return ctx.reply(user, `an update of the bot's **ADMIN** slash commands is currently underway. Please allow a few minutes for the changes to be reflected.`)

}))

pcmd(['admin'], ['sudo', 'transfer'], withInteraction(async (ctx, user, args) => {
    const fromUser = await fetchOnly(args.from)
    const toUser = await fetchOnly(args.to)
    if (!fromUser.discord_id || !toUser.discord_id)
        return ctx.reply(user, `no user found for \`${fromUser.discord_id? args.to: args.from}\`. Please make sure they are already a bot user before attempting to transfer cards.`, 'red')

    if (fromUser.discord_id === toUser.discord_id)
        return ctx.reply(user, `the FROM and TO users cannot be the same!`, 'red')

    let transferIDs = []
    const fromCards = await getUserCards(ctx, fromUser)

    fromCards.map(x => {
        for (let i = 0; i < x.amount; i++)
            transferIDs.push(x.cardid)
    })

    return ctx.sendCfm(ctx, user, {
        question: `Do you want to transfer **${fromCards.length}** unique and **${transferIDs.length}** total cards from ${fromUser.username} to ${toUser.username}? This will delete all of ${fromUser.username}'s cards!`,
        onConfirm: async () => {
            await addUserCards(ctx, toUser, transferIDs)
            await UserCards.deleteMany({userid: fromUser.discord_id})
            return ctx.reply(user, `transferred **${fromCards.length}** unique and **${transferIDs.length}** total cards from ${fromUser.username} to ${toUser.username}!`, 'green', true)
        }
    })

}))

pcmd(['admin'], ['sudo', 'embargo'], withInteraction(async (ctx, user, args) => {
    const lift = args.lift
    const rpl = ['']
    await onUsersFromArgs(args, async (target, newargs) => {
        if(lift) {
            target.ban.embargo = false
            rpl.push(`${target.username} has been lifted`)
            await target.save()
            try {
                await ctx.direct(target, "Your embargo has been lifted, you may now return to normal bot usage. Please try to follow the rules, they can easily be found at \`/rules\`")
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
}))

pcmd(['admin'], ['sudo', 'wip'], ['sudo', 'maintenance'], withInteraction(async (ctx, user, args) => {
    ctx.settings.wipMsg = args.message? args.message: 'bot is currently under maintenance. Please check again later |ω･)ﾉ'
    ctx.settings.wip = !ctx.settings.wip

    if (!ctx.settings.wip)
        await ctx.bot.editStatus("online", { name: 'commands', type: 2})
    else
        await ctx.bot.editStatus("idle", { name: 'maintenance', type: 2})
    return ctx.reply(user, `maintenance mode is now **${ctx.settings.wip? `ENABLED` : `DISABLED`}**`)
}))

pcmd(['admin'], ['sudo', 'auclock'], withInteraction(async (ctx, user, ...args) => {
    ctx.settings.aucLock = !ctx.settings.aucLock

    return ctx.reply(user, `auction lock has been **${ctx.settings.aucLock? `ENABLED` : `DISABLED`}**`)
}))

pcmd(['admin'], ['sudo', 'announce'], withInteraction(async (ctx, user, args) => {
    const title = args.title
    const announcement = new Announcement()
    announcement.date = new Date()
    announcement.title = title
    announcement.body = args.message
    await announcement.save()

    return ctx.reply(user, {
        title,
        author: { name: `New announcement set` },
        description: args.message,
        footer: { text: `Date: ${announcement.date}` },
    })
}))

pcmd(['admin'], ['sudo', 'lead', 'lemons'], withInteraction(async (ctx, user) => {
    let allUsersWithLemons = (await Users.find(
        { lemons: {$gt: 0} }, 
        { username: 1, discord_id: 1, lemons: 1 }).lean()).sort((a, b) =>  b.lemons - a.lemons).slice(0, 200)

    let pages = []
    allUsersWithLemons.map((x, i) => {
        if (i % 20 == 0) pages.push(``)
        pages[Math.floor(i/20)] += `${i+1}: ${x.username} \`${x.discord_id}\` - **${numFmt(Math.round(x.lemons))}**${ctx.symbols.lemon}\n`
    })

    return ctx.sendPgn(ctx, user, {
        pages,
        embed: {
            author: {name:`Showing Top Lemon Balances for ${allUsersWithLemons.length} users`}
        }
    })
}))

pcmd(['admin'], ['sudo', 'lead', 'tomatoes'], withInteraction(async (ctx, user) => {
    const allUsersWithTomatoes = (await Users.find(
        { exp: {$gte: 1} }, 
        { username: 1, discord_id: 1, exp: 1 }, 
        { sort: {exp: -1} }).lean()).sort((a, b) => b.exp - a.exp).slice(0, 200)

    let pages = []
    allUsersWithTomatoes.map((x, i) => {
        if (i % 20 == 0) pages.push(``)
        pages[Math.floor(i/20)] += `${i+1}: ${x.username} \`${x.discord_id}\` - **${numFmt(Math.round(x.exp))}**${ctx.symbols.tomato}\n`
    })

    return ctx.sendPgn(ctx, user, {
        pages,
        embed: {
            author: {name:`Showing Top Tomato Balances for ${allUsersWithTomatoes.length} users`}
        }
    })
}))

pcmd(['admin'], ['sudo', 'lead', 'vials'], withInteraction(async (ctx, user) => {
    let allUsersWithVials = (await Users.find(
        { vials: {$gt: 0} },
        { username: 1, discord_id: 1, vials: 1 },).lean()).sort((a, b) => b.vials - a.vials).slice(0, 200)

    let pages = []
    allUsersWithVials.map((x, i) => {
        if (i % 20 == 0) pages.push(``)
        pages[Math.floor(i/20)] += `${i+1}: ${x.username} \`${x.discord_id}\` - **${numFmt(Math.round(x.vials))}**${ctx.symbols.vial}\n`
    })

    return ctx.sendPgn(ctx, user, {
        pages,
        embed: {
            author: {name:`Showing Top Vial Balances for ${allUsersWithVials.length} users`}
        }
    })
}))

pcmd(['admin'], ['sudo', 'lead', 'clout'], withInteraction(async (ctx, user) => {
    let allUsersWithClout = (await Users.find(
        { cloutedcols: {$exists: true, $ne: []} },
        { username: 1, discord_id: 1, cloutedcols: 1 }).lean())
        .sort((a, b) => b.cloutedcols.length - a.cloutedcols.length).slice(0, 200)

    let pages = []
    let cloutUsers = []
    allUsersWithClout.map((x, i) => {
        let cloutAmount = 0
        x.cloutedcols.map(x=> cloutAmount += x.amount)
        cloutUsers.push({discord_id: x.discord_id, username: x.username, amount: cloutAmount})
    })

    cloutUsers.sort((a, b) => b.amount - a.amount).map((x, i) => {
        if (i % 20 == 0) pages.push(``)
        pages[Math.floor(i/20)] += `${i+1}: ${x.username} \`${x.discord_id}\`: **${x.amount}**★\n`
    })

    return ctx.sendPgn(ctx, user, {
        pages,
        embed: {
            author: {name:`Showing Top Clout for ${allUsersWithClout.length} users`}
        }
    })
}))
