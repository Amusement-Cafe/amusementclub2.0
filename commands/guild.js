const {cmd, pcmd}       = require('../utils/cmd')
const color             = require('../utils/colors')
const GuildUser         = require("../collections/guildUser")
const msToTime          = require('pretty-ms')
const asdate            = require('add-subtract-date')
const _                 = require("lodash")


const {
    XPtoLEVEL,
    LEVELtoXP,
    numFmt,
    formatDateTimeRelative,
} = require('../utils/tools')

const {
    rankXP,
    addGuildXP,
    getMaintenanceCost,
    isUserOwner,
    getGuildUser,
    guildLock,
    getBuildingInfo,
    isUserManager,
    dropCache,
    fetchGuildUsers,
    getAllBuildings,
    getBuilding,
    deleteBuilding,
} = require('../modules/guild')

const {
    fetchOnly,
} = require('../modules/user')

const {
    parseArgs,
} = require('../modules/card')

const {
    get_hero,
} = require('../modules/hero')

const {
    byAlias,
    bestColMatch,
} = require('../modules/collection')

const {
    withInteraction,
} = require("../modules/interactions")


cmd(['guild', 'info'], withInteraction(async (ctx, user, args) => {
    if (args.building)
        return getBuildingInfo(ctx, user, args.building)

    const resp = [], userstat = [], fields = []
    const guildlvl = XPtoLEVEL(ctx.guild.xp)
    const prevxp = LEVELtoXP(guildlvl)
    const nextxp = LEVELtoXP(guildlvl + 1)
    const channels = ctx.guild.botchannels.filter(x => ctx.discord_guild.channels.some(y => y.id === x))
    const gUsers = await GuildUser.find({guildid: ctx.guild.id}).lean()
    resp.push(`Level: **${guildlvl}** (${(((ctx.guild.xp - prevxp)/(nextxp - prevxp)) * 100).toFixed(1)}%)`)
    resp.push(`Players: **${numFmt(gUsers.length)}/${numFmt(ctx.discord_guild.memberCount)}**`)
    resp.push(`Claim tax: **${Math.round(ctx.guild.tax * 100)}%**`)
    resp.push(`Bot channels: ${channels.map(x => `<#${x}>`).join(' ')}`)

    const lock = ctx.guild.overridelock || ctx.guild.lock
    if(lock) {
        const lockcol = byAlias(ctx, lock)[0]
        resp.push(`Locked to: **${lockcol.name}**`)
    }

    // if(ctx.guild.hero) {
    //     const hero = await get_hero(ctx, ctx.guild.hero)
    //     fields.push({ name: `Guild hero`, value: `**${hero.name}** level **${XPtoLEVEL(hero.xp)}**
    //         Loyalty level **${ctx.guild.heroloyalty}**` })
    // }

    const curUser = gUsers.find(x => x.userid === user.discord_id)
    if(curUser){
        userstat.push(`Current level: **${curUser.level}**`)
        userstat.push(`Progress to the next level: **${curUser.level == 5? 'Max': Math.round((curUser.xp / rankXP[curUser.level]) * 100) + '%'}**`)
        if(curUser.roles.length > 0)
            userstat.push(`Roles: **${curUser.roles.join(' | ')}**`)
    } else {
        userstat.push(`You don't have statistics in this guild`)
    }

    fields.push({ name: `Your guild stats`, value: userstat.join('\n') })

    const buildings = await getAllBuildings(ctx, ctx.guild.id)
    if(buildings.length > 0)
        fields.push({ name: `Buildings`, value: buildings.map(x => {
                const item = ctx.items.find(y => y.id === x.id)
                return `\`${item.id}\` **${item.name} level ${x.level}** (${item.desc})`
            }).join('\n')
        })

    return ctx.send(ctx.interaction, {
        author: { name: ctx.discord_guild.name },
        description: resp.join('\n'),
        thumbnail: { url: ctx.discord_guild.iconURL },
        fields: fields,
        color: color.blue
    }, user.discord_id)
}))

cmd(['guild', 'status'], withInteraction(async (ctx, user) => {
    const resp = []
    const cost = await getMaintenanceCost(ctx)
    const ratio = ctx.guild.balance / cost
    const buildings = await getAllBuildings(ctx, ctx.guild.id)

    resp.push(`Current finances: **${numFmt(ctx.guild.balance)}** ${ctx.symbols.tomato} | **${numFmt(ctx.guild.lemons)}** ${ctx.symbols.lemon} `)
    if (cost > 0) {
        resp.push(`Daily maintenance: **${numFmt(cost)}** ${ctx.symbols.tomato}/day`)
        resp.push(`Maintenance charges **${formatDateTimeRelative(ctx.guild.nextcheck)}**`)
        resp.push(`Balance/Cost Ratio: **${Math.round(ratio)}**`)
        resp.push(`> Make sure you have a **positive** ratio when maintenance costs are charged`)
    } else {
        resp.push(`> There are no maintenance charges for this guild!`)
    }

    const fields = [{
        name: `Maintenance breakdown`, value: buildings.map(x => {
            const item = ctx.items.find(y => y.id === x.id)
            const heart = x.health < 50? '💔' : '❤️'
            return `[\`${heart}\` ${x.health}] **${item.name}** level **${x.level}** costs **${item.levels[x.level - 1].maintenance}** ${ctx.symbols.tomato}/day`
        }).join('\n')
    }]
    return ctx.send(ctx.interaction, {
        author: { name: ctx.discord_guild.name },
        description: resp.join('\n'),
        fields,
        color: (ratio >= 1? color.green : color.red)
    }, user.discord_id)
}))

cmd(['guild', 'donate'], withInteraction(async (ctx, user, args) => {
    let amount = args.amount

    amount = Math.abs(amount)
    if(user.exp < amount)
        return ctx.reply(user, `you don't have **${numFmt(amount)}** ${ctx.symbols.tomato} to donate`, 'red')

    const question = `Do you want to donate **${numFmt(amount)}** ${ctx.symbols.tomato} to **${ctx.discord_guild.name}**?`
    return ctx.sendCfm(ctx, user, {
        question,
        force: ctx.globals.force,
        onConfirm: async (x) => {
            const xp = Math.floor(amount * .01)
            user.exp -= amount
            user.xp += xp
            ctx.guild.balance += amount
            await addGuildXP(ctx, user, xp)

            await user.save()
            await ctx.guild.save()

            return ctx.reply(user, `you donated **${numFmt(amount)}** ${ctx.symbols.tomato} to **${ctx.discord_guild.name}**!
                This guild now has **${numFmt(ctx.guild.balance)}** ${ctx.symbols.tomato}
                You have been awarded **${Math.floor(xp)} xp** towards your next rank`, 'green', true)
        }
    })
}))

cmd(['guild', 'set', 'tax'], withInteraction(async (ctx, user, args) => {
    const tax = args.tax

    if(!isUserOwner(ctx, user) && !isUserManager(ctx, user) && !user.roles.includes('admin'))
        return ctx.reply(user, `only server owner can modify guild tax`, 'red')

    if(isNaN(tax))
        return ctx.reply(user, `please specify a number that indicates % of claim tax`, 'red')

    // if(tax > 15)
    //     return ctx.reply(user, `maximum allowed tax for current level is **15%**`, 'red')

    ctx.guild.tax = tax * .01
    await ctx.guild.save()

    return ctx.reply(user, `guild claim tax was set to **${tax}%**`)
}))

cmd(['guild', 'set', 'report'], withInteraction(async (ctx, user) => {
    if(!isUserOwner(ctx, user) && !user.roles.includes('admin'))
        return ctx.reply(user, `only owner can change guild's report channel`, 'red')

    ctx.guild.reportchannel = ctx.interaction.channel.id
    await ctx.guild.save()

    return ctx.reply(user, `marked this channel for guild reports`)
}))

cmd(['guild', 'set', 'bot'], withInteraction(async (ctx, user) => {
    if(ctx.guild.botchannels.length > 0 && !isUserOwner(ctx, user) && !user.roles.includes('admin'))
        return ctx.reply(user, `only server owner can add bot channels`, 'red')

    if(ctx.guild.botchannels.includes(ctx.interaction.channel.id))
        return ctx.reply(user, `this channel is already marked as bot channel`, 'red')

    ctx.guild.botchannels.push(ctx.interaction.channel.id)
    await ctx.guild.save()

    return ctx.reply(user, `marked this channel for bot`)
}))

cmd(['guild', 'unset', 'bot'], withInteraction(async (ctx, user) => {
    if(!isUserOwner(ctx, user) && !user.roles.includes('admin'))
        return ctx.reply(user, `only server owner can remove bot channels`, 'red')

    const pulled = ctx.guild.botchannels.pull(ctx.interaction.channel.id)
    if(pulled.length === 0)
        return ctx.reply(user, `this channel was not marked as bot channel`, 'red')

    await ctx.guild.save()

    return ctx.reply(user, `removed this channel from bot channel list`)
}))

cmd(['guild', 'manager', 'add'], withInteraction(async (ctx, user, args) => {
    if(!isUserOwner(ctx, user) && !user.roles.includes('admin'))
        return ctx.reply(user, `only owner can add guild managers`, 'red')

    if(!args.ids[0])
        return ctx.reply(user, `please include ID of a target user`, 'red')

    const tgUser = await fetchOnly(args.ids[0])
    if(!tgUser)
        return ctx.reply(user, `user with ID \`${args.ids[0]}\` was not found`, 'red')

    const target = ctx.guild.userstats.find(x => x.id === tgUser.discord_id)
    if(!target)
        return ctx.reply(user, `it appears that **${tgUser.username}** is not a member of this guild`, 'red')

    if(target.roles.includes('manager'))
        return ctx.reply(user, `it appears that **${tgUser.username}** already has a manager role`, 'red')

    target.roles.push('manager')
    ctx.guild.markModified('userstats')
    await ctx.guild.save()

    return ctx.reply(user, `successfully assigned manager role to **${tgUser.username}**`)
}))

cmd(['guild', 'manager', 'remove'], withInteraction(async (ctx, user, args) => {
    if(!isUserOwner(ctx, user) && !user.roles.includes('admin'))
        return ctx.reply(user, `only owner can remove guild managers`, 'red')

    if(!args.ids[0])
        return ctx.reply(user, `please, include ID of a target user`, 'red')

    const tgUser = await fetchOnly(args.ids[0])
    if(!tgUser)
        return ctx.reply(user, `user with ID \`${args.ids[0]}\` was not found`, 'red')

    const target = ctx.guild.userstats.find(x => x.id === tgUser.discord_id)
    if(!target)
        return ctx.reply(user, `it appears that **${tgUser.username}** is not a member of this guild`, 'red')

    if(!target.roles.includes('manager'))
        return ctx.reply(user, `it appears that **${tgUser.username}** doesn't have a manager role`, 'red')

    target.roles.pull('manager')
    ctx.guild.markModified('userstats')
    await ctx.guild.save()

    return ctx.reply(user, `successfully removed manager role from **${tgUser.username}**`)
}))

cmd(['guild', 'lock'], withInteraction(async (ctx, user, args) => {
    const guildUser = await getGuildUser(ctx, user)
    if(!isUserOwner(ctx, user) && !(guildUser && guildUser.roles.includes('manager')))
        return ctx.reply(user, `only owner or guild manager can set guild lock`, 'red')


    const col = _.flattenDeep(args.cols)[0]

    if(!col)
        return ctx.reply(user, `collection **${args.colQuery}** not found`, 'red')

    if(ctx.guild.lock && ctx.guild.lock === col.id)
        return ctx.reply(user, `this guild is already locked to **${col.name}**`, 'red')

    if(col.promo)
        return ctx.reply(user, `you cannot lock guild to promo collections`, 'red')

    const colCards = ctx.cards.filter(x => x.col === col.id && x.level < 4)
    if(colCards.length === 0)
        return ctx.reply(user, `cannot lock this guild to **${col.name}**`, 'red')

    if(ctx.guild.overridelock) {
        const ocol = byAlias(ctx, ctx.guild.overridelock)[0]
        return ctx.reply(user, `this guild is already locked to **${ocol.name}** using lock override.
            Override can be removed only by bot moderator.
            If you wish override to be removed, please ask in [Amusement Café](${ctx.cafe})`, 'red')
    }

    const price = guildLock.price
    if(ctx.guild.balance < price)
        return ctx.reply(user, `this guild doesn't have **${numFmt(price)}** ${ctx.symbols.tomato} required for a lock`, 'red')

    const now = new Date()
    const future = asdate.add(new Date(ctx.guild.lastlock.getTime()), 7, 'days')
    if(future > now)
        return ctx.reply(user, `you can use lock in **${msToTime(future - now, { compact: true })}**`, 'red')

    const question = `Do you want lock this guild to **${col.name}** using **${numFmt(price)}** ${ctx.symbols.tomato} ?
        >>> This will add **${numFmt(guildLock.maintenance)}** ${ctx.symbols.tomato} to guild maintenance.
        Lock will be paused if guild balance goes negative.
        Locking to another collection will cost **${numFmt(price)}** ${ctx.symbols.tomato}
        You won't be able to change lock for 7 days.
        You can unlock any time.
        Users will still be able to claim cards from general pool using \`/claim cards unlocked:true\``

    return ctx.sendCfm(ctx, user, {
        question,
        force: ctx.globals.force,
        onConfirm: async (x) => {

            ctx.guild.balance -= price
            ctx.guild.lock = col.id
            ctx.guild.lastlock = now
            ctx.guild.lockactive = true

            await ctx.guild.save()

            return ctx.reply(user, `you locked **${ctx.discord_guild.name}** to **${col.name}**
                Claim pool now consists of **${numFmt(colCards.length)}** cards`, 'green', true)

        }, 
        onDecline: (x) => ctx.reply(user, 'operation was cancelled. Guild lock was not applied', 'red', true)
    })
}))

cmd(['guild', 'unlock'], withInteraction(async (ctx, user) => {
    const guildUser = await getGuildUser(ctx, user)
    if(!isUserOwner(ctx, user) && !(guildUser && guildUser.roles.includes('manager')))
        return ctx.reply(user, `only owner or guild manager can remove guild lock`, 'red')

    if(!ctx.guild.lock)
        return ctx.reply(user, `this guild is not locked to any collection`, 'red')

    const col = byAlias(ctx, ctx.guild.lock)[0]
    const question = `Do you want to remove lock to **${col.name}**?
        This cannot be undone and won't reset lock cooldown.
        > This won't remove a lock override (if this guild has one)`

    return ctx.sendCfm(ctx, user, {
        question,
        force: ctx.globals.force,
        onConfirm: async (x) => {
            const colCards = ctx.cards.filter(x => x.level < 4)
            ctx.guild.lock = ''

            await ctx.guild.save()

            return ctx.reply(user, `guild lock has been removed.
                Claim pool now consists of **${numFmt(colCards.length)}** cards`, 'green', true)
        }
    })
}))

cmd(['guild', 'lead'], withInteraction(async (ctx, user) => {
    const guildUsers = await fetchGuildUsers(ctx).select('discord_id username hero')
    const heroes = await Promise.all(guildUsers.map(x => x.hero? get_hero(ctx, x.hero) : {id: -1}))
    const pages = ctx.pgn.getPages(ctx.guild.userstats
        .sort((a, b) => b.xp - a.xp)
        .sort((a, b) => b.rank - a.rank)
        .map((x, i) => {
        const curUser = guildUsers.find(y => y.discord_id === x.id)
        const xpSum = rankXP.slice(0, x.rank).reduce((acc, cur) => acc + cur, 0) + x.xp
        const hero = heroes.find(y => y.id === curUser.hero)
        return `${i + 1}. **${curUser.username}** (${numFmt(xpSum)}xp) ${hero? `\`${hero.name}\`` : ''}`
    }))

    return ctx.sendPgn(ctx, user, {
        pages,
        buttons: ['back', 'forward'],
        embed: {
            title: `${ctx.discord_guild.name} leaderboard:`,
            color: color.blue,
        }
    })
}))

cmd(['guild', 'convert'], withInteraction(async (ctx, user, args) => {
    const guildUser = await getGuildUser(ctx, user)
    if(!isUserOwner(ctx, user) && !(guildUser && guildUser.roles.includes('manager')))
        return ctx.reply(user, `only owner or guild manager can convert lemons!`, 'red')

    if (args.amount > ctx.guild.lemons)
        return ctx.reply(user, `this guild only has **${numFmt(ctx.guild.lemons)}**${ctx.symbols.lemon}, you can't convert **${numFmt(args.amount)}**!`, 'red')

    const converted = args.amount * 5

    return ctx.sendCfm(ctx, user, {
        question: `Do you want to convert **${numFmt(args.amount)}**${ctx.symbols.lemon} into **${numFmt(converted)}**${ctx.symbols.tomato}?
        The current conversion rate for lemons to tomatoes is 1:5!`,
        onConfirm: async () => {
            ctx.guild.lemons -= args.amount
            ctx.guild.balance += converted
            await ctx.guild.save()
            return ctx.reply(user, `you have successfully converted **${numFmt(args.amount)}**${ctx.symbols.lemon} into **${numFmt(converted)}**${ctx.symbols.tomato}`, 'green', true)
        }
    })
}))

cmd(['guild', 'upgrade'], withInteraction(async (ctx, user, args) => {
    const guildUser = await getGuildUser(ctx, user)
    if(!isUserOwner(ctx, user) && !(guildUser && guildUser.roles.includes('manager')))
        return ctx.reply(user, `only owner or guild manager can upgrade buildings!`, 'red')

    const reg = new RegExp(args.building, 'gi')
    const item = ctx.items.filter(x => x.type === 'guild').find(x => reg.test(x.id))
    if(!item)
        return ctx.reply(user, `building with ID \`${args.building}\` was not found`, 'red')

    const building = await getBuilding(ctx, ctx.guild.id, item.id)
    if(!building || building.health < 25)
        return ctx.reply(user, `**${item.name}** is not built in this guild, or it is too damaged to upgrade!`, 'red')

    if(!item.levels[building.level])
        return ctx.reply(user, `this building is already max level!`, 'red')

    const nextLevel = item.levels[building.level]

    if (nextLevel.price > ctx.guild.balance)
        return ctx.reply(user, `there are insufficient funds in the guild balance! You need **${nextLevel.price}**${ctx.symbols.tomato} to upgrade this building!`, 'red')

    return ctx.sendCfm(ctx, user, {
        question: `Do you want to upgrade this guild's \`${item.name}\` to level **${building.level + 1}**?
        This will cost **${nextLevel.price}**${ctx.symbols.tomato} and the new daily cost will be **${nextLevel.maintenance}**${ctx.symbols.tomato}`,
        onConfirm: async () => {
            building.level++
            await building.save()
            ctx.guild.balance -= nextLevel.price
            await ctx.guild.save()
            return ctx.reply(user, `you have successfully upgraded the \`${item.name}\` to level ${building.level}!
            The building will now ${item.levels[building.level - 1].desc}`, 'green', true)
        }
    })
}))

cmd(['guild', 'downgrade'], withInteraction(async (ctx, user, args) => {
    const guildUser = await getGuildUser(ctx, user)
    if(!isUserOwner(ctx, user) && !(guildUser && guildUser.roles.includes('manager')))
        return ctx.reply(user, `only owner or guild manager can downgrade buildings!`, 'red')

    const reg = new RegExp(args.building, 'gi')
    const item = ctx.items.filter(x => x.type === 'guild').find(x => reg.test(x.id))
    let demolish = false
    if(!item)
        return ctx.reply(user, `building with ID \`${args.building}\` was not found`, 'red')

    const building = await getBuilding(ctx, ctx.guild.id, item.id)
    if(!building)
        return ctx.reply(user, `**${item.name}** is not built in this guild`, 'red')

    if(!item.levels[building.level - 2])
        demolish = true

    let question = `Do you want to downgrade this guild's \`${item.name}\` to level **${building.level - 1}**? You will not get any refund for the upgrade cost required to reach the current level!`

    if (demolish)
        question = `Do you want to demolish this guilds \`${item.name}\`? You will not get a refund for the cost of the initial building and will have to rebuy it again to regain this building!`

    return ctx.sendCfm(ctx, user, {
        question,
        onConfirm: async () => {
            if (demolish) {
                await deleteBuilding(ctx, ctx.guild.id, building.id)
                return ctx.reply(user, `the \`${item.name}\` has been demolished!`, 'green', true)
            }

            building.level--
            await building.save()
            return ctx.reply(user, `you have successfully downgraded the \`${item.name}\` to level ${building.level}!
            The building will now ${item.levels[building.level - 1].desc}`, 'green', true)
        }
    })
}))

pcmd(['admin'], ['sudo', 'guild', 'cache', 'flush'], (ctx, user) => {
    dropCache()
    return ctx.reply(user, 'guild cache was reset')
})
