const {cmd, pcmd}       = require('../utils/cmd')
const {XPtoLEVEL}       = require('../utils/tools')
const color             = require('../utils/colors')
const msToTime          = require('pretty-ms')
const asdate            = require('add-subtract-date')

const {
    rankXP,
    addGuildXP,
    getMaintenanceCost,
    isUserOwner,
    getGuildUser,
    guildLock,
    getBuildingInfo,
    isUserManager,
    dropCache
} = require('../modules/guild')

const {
    fetchOnly
} = require('../modules/user')

const {
    parseArgs
} = require('../modules/card')

const {
    get_hero
} = require('../modules/hero')

const {
    byAlias,
    bestColMatch
} = require('../modules/collection')

cmd(['guild'], async (ctx, user) => {
    return ctx.qhelp(ctx, user, 'guild')
})

cmd(['guild', 'info'], async (ctx, user, ...args) => {
    if(args.length > 0)
        return getBuildingInfo(ctx, user, args)

    const resp = [], userstat = [], fields = []
    const channels = ctx.guild.botchannels.filter(x => ctx.discord_guild.channels.some(y => y.id === x))
    resp.push(`Level: **${XPtoLEVEL(ctx.guild.xp)}**`)
    resp.push(`Players: **${ctx.guild.userstats.length}/${ctx.discord_guild.memberCount}**`)
    resp.push(`Prefix: \`${ctx.guild.prefix}\``)
    resp.push(`Claim tax: **${Math.round(ctx.guild.tax * 100)}%**`)
    resp.push(`Building permissions: **Rank ${ctx.guild.buildperm}+**`)
    resp.push(`Bot channels: ${channels.map(x => `<#${x}>`).join(' ')}`)

    const lock = ctx.guild.overridelock || ctx.guild.lock
    if(lock) {
        const lockcol = byAlias(ctx, lock)[0]
        resp.push(`Locked to: **${lockcol.name}**`)
    }

    if(ctx.guild.hero) {
        const hero = await get_hero(ctx, ctx.guild.hero)
        fields.push({ name: `Guild hero`, value: `**${hero.name}** level **${XPtoLEVEL(hero.xp)}**
            Loyalty level **${ctx.guild.heroloyalty}**` })
    }

    const curUser = ctx.guild.userstats.find(x => x.id === user.discord_id)
    if(curUser){
        userstat.push(`Current rank: **${curUser.rank}**`)
        userstat.push(`Progress to the next rank: **${curUser.rank == 5? 'Max': Math.round((curUser.xp / rankXP[curUser.rank]) * 100) + '%'}**`)
        if(curUser.roles.length > 0)
            userstat.push(`Roles: **${curUser.roles.join(' | ')}**`)
    } else {
        userstat.push(`You don't have statistics in this guild`)
    }

    fields.push({ name: `Your guild stats`, value: userstat.join('\n') })

    if(ctx.guild.buildings.length > 0)
        fields.push({ name: `Buildings`, value: ctx.guild.buildings.map(x => {
            const item = ctx.items.find(y => y.id === x.id)
            return `\`${item.id}\` **${item.name} level ${x.level}** (${item.desc})`
        }).join('\n')
    })

    return ctx.send(ctx.msg.channel.id, {
        author: { name: ctx.discord_guild.name },
        description: resp.join('\n'),
        thumbnail: { url: ctx.discord_guild.iconURL },
        fields: fields,
        color: color.blue
    }, user.discord_id)
})

cmd(['guild', 'status'], (ctx, user) => {
    const castle = ctx.guild.buildings.find(x => x.id === 'castle')
    if(!castle)
        return ctx.reply(user, 'status check only possible in guild that has **Guild Castle**. Buy one in the `->store`', 'red')

    const resp = []
    const cost = getMaintenanceCost(ctx)
    const total = Math.round(cost - cost * ctx.guild.discount)
    const ratio = total / ctx.guild.balance

    resp.push(`Building maintenance: **${cost}** ${ctx.symbols.tomato}/day`)

    if(ctx.guild.discount > 0) {
        resp.push(`Maintenance discount: **${ctx.guild.discount * 100}%**`)
        resp.push(`Subtotal after discounts: **${total}** ${ctx.symbols.tomato}/day`)
    }
    resp.push(`Current finances: **${ctx.guild.balance}** ${ctx.symbols.tomato}`)
    resp.push(`Ratio: **${ratio.toFixed(2)}** (${ratio <= 1? 'positive' : 'negative'})`)
    resp.push(`Maintenance charges in **${msToTime(ctx.guild.nextcheck - new Date(), {compact: true})}**`)
    resp.push(`> Make sure you have **positive** ratio when maintenance costs are charged`)

    return ctx.send(ctx.msg.channel.id, {
        author: { name: ctx.discord_guild.name },
        description: resp.join('\n'),
        fields: [{name: `Maintenance breakdown`, value: ctx.guild.buildings.map(x => {
            const item = ctx.items.find(y => y.id === x.id)
            const heart = x.health < 50? '💔' : '❤️'
            return `[\`${heart}\` ${x.health}] **${item.name}** level **${x.level}** costs **${item.levels[x.level - 1].maintenance}** ${ctx.symbols.tomato}/day`
        }).join('\n')}],
        color: (ratio <= 1? color.green : color.red)
    }, user.discord_id)
})

cmd(['guild', 'upgrade'], async (ctx, user, arg1) => {
    if(!arg1)
        return ctx.reply(user, 'please specify building ID', 'red')

    if(!getGuildUser(ctx, user))
        return ctx.reply(user, 'you are not a part of this guild. Claim a card or daily to join', 'red')

    if(!isUserOwner(ctx, user) && getGuildUser(ctx, user).rank < ctx.guild.buildperm)
        return ctx.reply(user, `you have to be at least rank **${ctx.guild.buildperm}** to upgrade buildings in this guild`, 'red')

    const building = ctx.guild.buildings.find(x => x.id === arg1)
    const item = ctx.items.find(x => x.id === arg1)

    if(!building)
        return ctx.reply(user, `building with ID \`${arg1}\` not found`, 'red')

    const level = item.levels[building.level]
    if(!level)
        return ctx.reply(user, `**${item.name}** is already max level`, 'red')

    if(XPtoLEVEL(ctx.guild.xp) < level.level)
        return ctx.reply(user, `this guild has to be at least level **${level.level}** to have **${item.name} level ${building.level + 1}**`, 'red')

    if(user.exp < level.price)
        return ctx.reply(user, `you have to have at least **${level.price}** ${ctx.symbols.tomato} to upgrade this building`, 'red')

    const question = `Do you want to upgrade **${item.name}** to level **${building.level + 1}** for **${level.price}** ${ctx.symbols.tomato}?`
    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question,
        force: ctx.globals.force,
        onConfirm: async (x) => {
            const xp = Math.floor(level.price * .04)
            building.level++
            user.exp -= level.price
            user.xp += xp
            ctx.guild.markModified('buildings')
            addGuildXP(ctx, user, xp)

            await user.save()
            await ctx.guild.save()

            return ctx.reply(user, `you successfully upgraded **${item.name}** to level **${building.level}**!
                This building now *${level.desc.toLowerCase()}*
                You have been awarded **${Math.floor(xp)} xp** towards your next rank`)

        },
    })
})

cmd(['guild', 'downgrade'], ['guild', 'down'], async (ctx, user, arg1) => {
    if(!isUserOwner(ctx, user) && !isUserManager(ctx, user) && !user.roles.includes('admin'))
        return ctx.reply(user, `only server owner can downgrade buildings`, 'red')

    if(!arg1)
        return ctx.reply(user, 'please specify building ID', 'red')

    const building = ctx.guild.buildings.find(x => x.id === arg1)
    const item = ctx.items.find(x => x.id === arg1)

    if(!building)
        return ctx.reply(user, `building with ID \`${arg1}\` not found`, 'red')

    if (item.id == "castle" && building.level - 1 == 0)
        return ctx.reply(user, `you cannot destroy your own castle!`, 'red')

    const question = `Do you want to downgrade **${item.name}** to level **${building.level - 1}**?
        It will be destroyed once reaches level 0`
    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question,
        force: ctx.globals.force,
        onConfirm: async (x) => {
            building.level--

            const destroyed = building.level < 1
            if(destroyed) {
                ctx.guild.buildings = ctx.guild.buildings.filter(x => x.id != building.id)
            }

            ctx.guild.markModified('buildings')
            await ctx.guild.save()

            if(destroyed) {
                return ctx.reply(user, `the building **${item.name}** has been destroyed`)
            }
            return ctx.reply(user, `the building **${item.name}** has been downgraded to level **${building.level}**`)
        },
    })
})

cmd(['guild', 'donate'], async (ctx, user, arg1) => {
    let amount = parseInt(arg1)
    const castle = ctx.guild.buildings.find(x => x.id === 'castle')

    if(!castle)
        return ctx.reply(user, '**Guild Castle** is required before you can donate. Buy one in the `->store`', 'red')

    if(!amount)
        return ctx.reply(user, `please enter amount of ${ctx.symbols.tomato} you want to donate to this guild`, 'red')

    amount = Math.abs(amount)
    if(user.exp < amount)
        return ctx.reply(user, `you don't have **${amount}** ${ctx.symbols.tomato} to donate`, 'red')

    const question = `Do you want to donate **${amount}** ${ctx.symbols.tomato} to **${ctx.discord_guild.name}**?`
    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question,
        force: ctx.globals.force,
        onConfirm: async (x) => {
            const xp = Math.floor(amount * .01)
            user.exp -= amount
            user.xp += xp
            ctx.guild.balance += amount
            addGuildXP(ctx, user, xp)

            await user.save()
            await ctx.guild.save()

            return ctx.reply(user, `you donated **${amount}** ${ctx.symbols.tomato} to **${ctx.discord_guild.name}**!
                This now has **${ctx.guild.balance}** ${ctx.symbols.tomato}
                You have been awarded **${Math.floor(xp)} xp** towards your next rank`)
        }
    })
})

cmd(['guild', 'set', 'tax'], async (ctx, user, arg1) => {
    const tax = Math.abs(parseInt(arg1))
    const castle = ctx.guild.buildings.find(x => x.id === 'castle')

    if(!castle)
        return ctx.reply(user, '**Guild Castle** is required to set claim tax. Buy one in the `->store`', 'red')

    if(!isUserOwner(ctx, user) && !isUserManager(ctx, user) && !user.roles.includes('admin'))
        return ctx.reply(user, `only server owner can modify guild tax`, 'red')

    if(!tax)
        return ctx.reply(user, `please specify a number that indicates % of claim tax`, 'red')

    if(castle.level < 2 && tax > 5)
        return ctx.reply(user, `maximum allowed tax for current level is **5%**`, 'red')

    if(castle.level < 4 && tax > 10)
        return ctx.reply(user, `maximum allowed tax for current level is **10%**`, 'red')

    if(tax > 25)
        return ctx.reply(user, `maximum allowed tax for current level is **25%**`, 'red')

    ctx.guild.tax = tax * .01
    await ctx.guild.save()

    return ctx.reply(user, `guild claim tax was set to **${tax}%**`)
})

cmd(['guild', 'set', 'report'], async (ctx, user) => {
    if(!isUserOwner(ctx, user) && !user.roles.includes('admin'))
        return ctx.reply(user, `only owner can change guild's report channel`, 'red')

    ctx.guild.reportchannel = ctx.msg.channel.id
    await ctx.guild.save()

    return ctx.reply(user, `marked this channel for guild reports`)
})

cmd(['guild', 'set', 'bot'], async (ctx, user) => {
    if(!isUserOwner(ctx, user) && !user.roles.includes('admin'))
        return ctx.reply(user, `only owner can change guild's report channel`, 'red')

    if(ctx.guild.botchannels.includes(ctx.msg.channel.id))
        return ctx.reply(user, `this channel is already marked as bot channel`, 'red')

    ctx.guild.botchannels.push(ctx.msg.channel.id)
    await ctx.guild.save()

    return ctx.reply(user, `marked this channel for bot`)
})

cmd(['guild', 'unset', 'bot'], async (ctx, user) => {
    if(!isUserOwner(ctx, user) && !user.roles.includes('admin'))
        return ctx.reply(user, `only owner can change guild's report channel`, 'red')

    const pulled = ctx.guild.botchannels.pull(ctx.msg.channel.id)
    if(pulled.length === 0)
        return ctx.reply(user, `this channel was not marked as bot channel`, 'red')

    await ctx.guild.save()

    return ctx.reply(user, `removed this channel from bot channel list`)
})

cmd(['guild', 'set', 'buildrank'], async (ctx, user, arg1) => {
    const guildUser = ctx.guild.userstats.find(x => x.id === user.discord_id)
    if(!isUserOwner(ctx, user) && !isUserManager(ctx, user))
        return ctx.reply(user, `only owner or manager can change guild's required build rank`, 'red')

    const rank = Math.abs(parseInt(arg1))

    if(!rank || rank < 1 || rank > 5)
        return ctx.reply(user, `please specify a number 1-5`, 'red')

    ctx.guild.buildperm = rank
    await ctx.guild.save()

    return ctx.reply(user, `minimum rank for building in this guild has been set to **${rank}**`)
})

cmd(['guild', 'add', 'manager'], ['guild', 'add', 'mod'], async (ctx, user, ...args) => {
    if(!isUserOwner(ctx, user) && !user.roles.includes('admin'))
        return ctx.reply(user, `only owner can add guild managers`, 'red')

    const newArgs = parseArgs(ctx, args)
    if(!newArgs.ids[0])
        return ctx.reply(user, `please include ID of a target user`, 'red')

    const tgUser = await fetchOnly(newArgs.ids[0])
    if(!tgUser)
        return ctx.reply(user, `user with ID \`${newArgs.ids[0]}\` was not found`, 'red')

    const target = ctx.guild.userstats.find(x => x.id === tgUser.discord_id)
    if(!target)
        return ctx.reply(user, `it appears that **${tgUser.username}** is not a member of this guild`, 'red')

    if(target.roles.includes('manager'))
        return ctx.reply(user, `it appears that **${tgUser.username}** already has a manager role`, 'red')

    target.roles.push('manager')
    ctx.guild.markModified('userstats')
    await ctx.guild.save()

    return ctx.reply(user, `successfully assigned manager role to **${tgUser.username}**`)
})

cmd(['guild', 'remove', 'manager'], ['guild', 'remove', 'mod'], async (ctx, user, ...args) => {
    if(!isUserOwner(ctx, user) && !user.roles.includes('admin'))
        return ctx.reply(user, `only owner can remove guild managers`, 'red')

    const newArgs = parseArgs(ctx, args)
    if(!newArgs.ids[0])
        return ctx.reply(user, `please, include ID of a target user`, 'red')

    const tgUser = await fetchOnly(newArgs.ids[0])
    if(!tgUser)
        return ctx.reply(user, `user with ID \`${newArgs.ids[0]}\` was not found`, 'red')

    const target = ctx.guild.userstats.find(x => x.id === tgUser.discord_id)
    if(!target)
        return ctx.reply(user, `it appears that **${tgUser.username}** is not a member of this guild`, 'red')

    if(!target.roles.includes('manager'))
        return ctx.reply(user, `it appears that **${tgUser.username}** doesn't have a manager role`, 'red')

    target.roles.pull('manager')
    ctx.guild.markModified('userstats')
    await ctx.guild.save()

    return ctx.reply(user, `successfully removed manager role from **${tgUser.username}**`)
})

cmd(['guild', 'lock'], async (ctx, user, arg1) => {
    const guildUser = ctx.guild.userstats.find(x => x.id === user.discord_id)
    if(!isUserOwner(ctx, user) && !(guildUser && guildUser.roles.includes('manager')))
        return ctx.reply(user, `only owner or guild manager can set guild lock`, 'red')

    if(!arg1)
        return ctx.reply(user, `please provide collection ID`, 'red')

    const price = guildLock.price
    if(ctx.guild.balance < price)
        return ctx.reply(user, `this guild doesn't have **${price}** ${ctx.symbols.tomato} required for a lock`, 'red')

    arg1 = arg1.replace('-', '')
    const col = bestColMatch(ctx, arg1)
    if(!col)
        return ctx.reply(user, `collection **${arg1}** not found`, 'red')

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

    const now = new Date()
    const future = asdate.add(new Date(ctx.guild.lastlock.getTime()), 7, 'days')
    if(future > now)
        return ctx.reply(user, `you can use lock in **${msToTime(future - now, { compact: true })}**`, 'red')

    const question = `Do you want lock this guild to **${col.name}** using **${price}** ${ctx.symbols.tomato} ?
        >>> This will add **${guildLock.maintenance}** ${ctx.symbols.tomato} to guild maintenance.
        Lock will be paused if guild balance goes negative.
        Locking to another collection will cost **${price}** ${ctx.symbols.tomato}
        You won't be able to change lock for 7 days.
        You can unlock any time.
        Users will still be able to claim cards from general pool using \`->claim any\``

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question,
        force: ctx.globals.force,
        onConfirm: async (x) => {

            ctx.guild.balance -= price
            ctx.guild.lock = col.id
            ctx.guild.lastlock = now
            ctx.guild.lockactive = true

            await ctx.guild.save()

            return ctx.reply(user, `you locked **${ctx.discord_guild.name}** to **${col.name}**
                Claim pool now consists of **${colCards.length}** cards`)

        }, 
        onDecline: (x) => ctx.reply(user, 'operation was cancelled. Guild lock was not applied', 'red')
    })
})

cmd(['guild', 'unlock'], async (ctx, user) => {
    const guildUser = ctx.guild.userstats.find(x => x.id === user.discord_id)
    if(!isUserOwner(ctx, user) && !(guildUser && guildUser.roles.includes('manager')))
        return ctx.reply(user, `only owner or guild manager can remove guild lock`, 'red')

    if(!ctx.guild.lock)
        return ctx.reply(user, `this guild is not locked to any collection`, 'red')

    const col = byAlias(ctx, ctx.guild.lock)[0]
    const question = `Do you want to remove lock to **${col.name}**?
        This cannot be undone and won't reset lock cooldown.
        > This won't remove a lock override (if this guild has one)`

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question,
        force: ctx.globals.force,
        onConfirm: async (x) => {
            const colCards = ctx.cards.filter(x => x.level < 4)
            ctx.guild.lock = ''

            await ctx.guild.save()

            return ctx.reply(user, `guild lock has been removed.
                Claim pool now consists of **${colCards.length}** cards`)
        }
    })
})

cmd(['guild', 'set', 'prefix'], async (ctx, user, arg1) => {
    const guildUser = ctx.guild.userstats.find(x => x.id === user.discord_id)
    if(!isUserOwner(ctx, user) && !(guildUser && guildUser.roles.includes('manager')))
        return ctx.reply(user, `only owner or guild manager can set guild prefix`, 'red')

    if(!arg1)
        return ctx.reply(user, `please specify new prefix`, 'red')

    if(arg1.length < 1 || arg1.length > 3)
        return ctx.reply(user, `prefix length can be between **1** and **3** charaters`, 'red')

    ctx.guild.prefix = arg1
    await ctx.guild.save()
    return ctx.reply(user, `guild prefix was set to \`${arg1}\``)
})

pcmd(['admin'], ['sudo', 'guild', 'cache', 'flush'], (ctx, user) => {
    dropCache()
    return ctx.reply(user, 'guild cache was reset')
})
