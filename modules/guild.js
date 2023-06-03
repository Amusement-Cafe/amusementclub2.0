const Guild         = require('../collections/guild')
const Transaction   = require('../collections/transaction')
const Auction       = require('../collections/auction')
const User          = require('../collections/user')
const GuildUser     = require('../collections/guildUser')
const GuildBuilding = require('../collections/guildBuilding')
const color         = require('../utils/colors')
const asdate        = require('add-subtract-date')
const msToTime      = require('pretty-ms')

const {
    check_effect,
} = require('./effect')

const {
    numFmt,
    formatDateTimeRelative
} = require('../utils/tools')

const m_hero = require('./hero')

let cache = []

const fetchOrCreate = async (ctx, user, discord_guild) => {
    if(!discord_guild)
        return null

    let fromcache = true
    let guild = cache.find(x => x.id === discord_guild.id)

    if(!guild) {
        guild = await Guild.findOne({ id: discord_guild.id })
        fromcache = false
    }

    if (!guild) {
        guild = await new Guild()
        guild.id = discord_guild.id
        guild.botchannels = [ctx.interaction.channel.id]
        guild.reportchannel = ctx.interaction.channel.id
        guild.nextcheck = asdate.add(new Date(), 20, 'hours')

        await guild.save()
        await ctx.bot.rest.channels.createMessage(ctx.interaction.channel.id, {
            embeds: [{
                description: `**${user.username}**, new guild added. This channel was marked as bot and report channel.
            Type \`/help help_menu:guild here:true\` to see more about guild setup`,
                color: color.green
            }]
        })
    }
    guild.cacheClear = asdate.add(new Date(), 12, 'hours')

    if(!fromcache)
        cache.push(guild)

    return guild
}

const fetchGuild = async (discord_guild) => {
    if(!discord_guild)
        return null

    return fetchGuildById(discord_guild.id)
}

const fetchGuildById = async (guildId) => {
    let fromcache = true
    let guild = cache.find(x => x.id === guildId)

    if(!guild) {
        guild = await Guild.findOne({ id: guildId })
        fromcache = false
    }

    if(!fromcache && guild)
        cache.push(guild)

    return guild
}

const addGuildXP = async (ctx, user, xp) => {
    let guildUser = await GuildUser.findOne({guildid: ctx.guild.id, userid: user.discord_id})
    
    if(!guildUser) {
        guildUser = new GuildUser()
        guildUser.guildid = ctx.guild.id
        guildUser.userid = user.discord_id
        await guildUser.save()

        if(user.xp > 10) {
            const warning = `\nPlease be aware that your claims are **${Math.round(ctx.guild.tax * 100)}%** more expensive here`
            ctx.reply(user, `welcome to **${ctx.discord_guild.name}!** ${ctx.guild.tax > 0? warning : ''}
                For more information run \`/guild info\``)
        }
    }

    ctx.guild.xp += xp * .05
    guildUser.xp += xp + (await check_effect(ctx, user, 'onvictory')? xp * .25 : 0)
    const rank = XPtoRANK(guildUser.xp)

    if(rank > guildUser.level) {
        await ctx.bot.rest.channels.createMessage(ctx.interaction.channelID, {
            embeds: [
                {
                    description: `**${user.username}**, you leveled up in **${ctx.discord_guild.name}!**
                    Your level is now **${rank}**`,
                    color: color.green
                }
            ]
        })

        guildUser.xp -= rankXP[rank - 1]
        guildUser.level = rank
    }
    await guildUser.save()
}

const clean_trans = async (ctx, now) => {
    const transactionTime = asdate.subtract(new Date(), 14, 'days')
    const trClean = await Transaction.deleteMany({time: {$lt: transactionTime}})
    const aucClean = await Auction.deleteMany({time: {$lt: transactionTime}})
    cache = cache.filter(x => x.cacheClear < new Date())
    if (trClean.n > 0 || aucClean.n > 0)
        console.log(`Cleaned ${trClean.n} transactions and ${aucClean.n} auctions`)
}

const bill_guilds = async (ctx, now) => {
    if (ctx.settings.wip)
        return

    const guild = await Guild.findOne({nextcheck: {$lt: now}, processing: {$ne: true}})

    if(!guild) return;
    console.log(guild.id)
    guild.processing = true
    await guild.save()

    let buildings = await getAllBuildings(ctx, guild.id)

    if(!guild.lockactive && (!buildings || buildings.length === 0)) {
        guild.nextcheck = asdate.add(new Date(), 24, 'hours')
        guild.processing = false
        await guild.save()
        return
    }

    const report = []
    ctx.guild = guild
    const total = await getMaintenanceCost(ctx)
    let ratio = guild.balance / total
    guild.balance = Math.max(0, guild.balance - total)

    if(ratio == Infinity)
        ratio = 0

    report.push(`Maintenance cost: **${numFmt(total)}** ${ctx.symbols.tomato}`)
    report.push(`Remaining guild balance: **${numFmt(guild.balance)}** ${ctx.symbols.tomato}`)

    if(ratio < 1) {
        guild.lockactive = false
        report.push(`> Lock has been disabled until next check`)
        if (buildings && buildings.length > 0) {
            await Promise.all(buildings.map(async x => {
                const info = ctx.items.find(y => y.id === x.id)
                x.health -= 5
                let demolish = false
                if (x.health <= 0 && x.level > 1) {
                    x.level--
                    x.health = 74
                    report.push(`${ctx.symbols.red_circle} **${info.name}** has dropped down to level **${x.level}**!`)
                    await x.save()

                } else if(x.health <= 0 && x.level <= 1) {
                    report.push(`${ctx.symbols.red_circle} **${info.name}** has been destroyed!`)
                    demolish = true
                    await deleteBuilding(ctx, guild.id, x.id)

                }
            }))
            report.push(`> All buildings have taken 5 damage due to insufficient funds!`)
            report.push(`> Buildings stop functioning at 25 health and are downgraded or deleted at 0 health`)
        }
    } else {
        report.push(`> All costs were covered!`)
        if (buildings && buildings.length > 0) {
            report.push(`> All buildings have been healed by 5 health`)
            await Promise.all(buildings.map(async x => {
                x.health = Math.min(x.health + 5, 100)
                await x.save()
            }))
        }
        if(guild.lock && !guild.lockactive) {
           report.push(`> Guild lock is back!`)
        }
        guild.lockactive = true
    }

    guild.nextcheck = asdate.add(new Date(), 24, 'hours')
    report.push(`Next check is **${formatDateTimeRelative(guild.nextcheck)}**`)
    guild.processing = false
    await guild.save()

    // m_hero.checkGuildLoyalty(isolatedCtx)

    const index = cache.findIndex(x => x.id === guild.id)
    cache[index] = guild
    
    try{
        await ctx.bot.rest.channels.createMessage(guild.reportchannel || guild.lastcmdchannel || guild.botchannels[0], {
            embeds: [{
                author: { name: `Receipt for ${now}` },
                description: report.join('\n'),
                color: (ratio < 1? color.red : color.green),
            }]})
    } catch (e) {process.send({error: {message: e.message, stack: e.stack}})}
}

const getMaintenanceCost = async (ctx) => {
    const buildings = await getAllBuildings(ctx, ctx.guild.id)
    let cost = ctx.guild.lock? guildLock.maintenance : 0
    buildings.map(x => {
        let item = ctx.items.find(y => y.id === x.id)
        cost += item.levels[x.level - 1].maintenance
    })
    const pamper = buildings.find(x => x.id === 'pampercentral')
    if (!pamper)
        return cost
    return cost * (1 - (pamper.level * 0.05))
}

const getBuildingInfo = async (ctx, user, args) => {
    const reg = new RegExp(args, 'gi')
    const item = ctx.items.filter(x => x.type === 'guild').find(x => reg.test(x.id))
    if(!item)
        return ctx.reply(user, `building with ID \`${args.join('')}\` was not found`, 'red')

    const building = await getBuilding(ctx, ctx.guild.id, item.id)
    if(!building)
        return ctx.reply(user, `**${item.name}** is not built in this guild`, 'red')

    const embed = {
        description: item.fulldesc,
        fields: item.levels.map((x, i) => ({
            name: `Level ${i + 1}`, 
            value: `Price: **${numFmt(x.price)}** ${ctx.symbols.tomato}
                > ${x.desc.replace(/{currency}/gi, ctx.symbols.tomato)}`
    }))}

    const heart = building.health < 50? '💔' : '❤️'
    embed.color = color.blue
    embed.author = { name: item.name }
    embed.fields = embed.fields.slice(building.level - 1)
    embed.fields.push({ name: `Health`, value: `**${building.health}** ${heart}` })
    embed.fields[0].name += ` (current)`

    return ctx.send(ctx.interaction, embed, user.discord_id)
}

const getAllBuildings = async (ctx, guildid) => await GuildBuilding.find({guildid: guildid})

const getBuilding = async (ctx, guildid, buildingid) => await GuildBuilding.findOne({guildid: guildid, id: buildingid})

const deleteBuilding = async (ctx, guildid, buildingid) => await GuildBuilding.deleteOne({guildid: guildid, id: buildingid})

const getGuildUser = async (ctx, user) => await GuildUser.findOne({guildid: ctx.guild.id, userid: user.discord_id})

const getGuildUsers = async (ctx) => await GuildUser.find({guildid: ctx.guild.id}).lean()

const isUserOwner = (ctx, user) => ctx.interaction.channel.guild.ownerID === user.discord_id

const fetchGuildUsers = async (ctx, users) => await User.find({ discord_id: {$in: users.map(x => x.userid) }})

const isUserManager = async (ctx, user) => {
    const guildUser = await getGuildUser(ctx, user)
    return (guildUser && guildUser.roles.includes('manager'))
}

const rankXP = [10, 100, 500, 2500, 10000]

const XPtoRANK = (xp) => rankXP.filter(x => xp > x).length

const dropCache = () => { 
    cache = []
}

const guildLock = {
    price: 100000,
    maintenance: 5000
}

module.exports = Object.assign(module.exports, {
    fetchOrCreate,
    addGuildXP,
    XPtoRANK,
    rankXP,
    getGuildUser,
    getGuildUsers,
    isUserOwner,
    getMaintenanceCost,
    bill_guilds,
    getBuilding,
    guildLock,
    getBuildingInfo,
    isUserManager,
    dropCache,
    fetchGuild,
    fetchGuildById,
    fetchGuildUsers,
    clean_trans,
    getAllBuildings,
    deleteBuilding,
})
