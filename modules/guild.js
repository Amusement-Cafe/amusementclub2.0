const Guild         = require('../collections/guild')
const Transaction   = require('../collections/transaction')
const Auction       = require('../collections/auction')
const User          = require('../collections/user')

const color         = require('../utils/colors')
const asdate        = require('add-subtract-date')
const msToTime      = require('pretty-ms')

const {
    check_effect,
} = require('./effect')

const {
    numFmt
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
        guild.botchannels = [ctx.msg.channel.id]
        guild.reportchannel = ctx.msg.channel.id
        guild.nextcheck = asdate.add(new Date(), 20, 'hours')

        await guild.save()
        await ctx.reply(user, `new guild added. This channel was marked as bot and report channel.
            Type \`->help guild -here\` to see more about guild setup`)
    }

    if(!fromcache)
        cache.push(guild)

    return guild
}

const fetchOnly = async (discord_guild) => {
    if(!discord_guild)
        return null

    let fromcache = true
    let guild = cache.find(x => x.id === discord_guild.id)

    if(!guild) {
        guild = await Guild.findOne({ id: discord_guild.id })
        fromcache = false
    }

    if(!fromcache && guild)
        cache.push(guild)

    return guild
}

const addGuildXP = (ctx, user, xp) => {
    let guildUser = ctx.guild.userstats.find(x => x.id === user.discord_id)
    
    if(!guildUser) {
        ctx.guild.userstats.push({ id: user.discord_id, xp: 0, rank: 0 })
        guildUser = ctx.guild.userstats.find(x => x.id === user.discord_id)

        if(user.xp > 10) {
            const warning = `\nPlease be aware that your claims are **${Math.round(ctx.guild.tax * 100)}%** more expensive here`
            ctx.reply(user, `welcome to **${ctx.discord_guild.name}!** ${ctx.guild.tax > 0? warning : ''}
                For more information run \`->guild info\``)
        }
    }

    ctx.guild.xp += xp * .05
    guildUser.xp += xp + (check_effect(ctx, user, 'onvictory')? xp * .25 : 0)
    const rank = XPtoRANK(guildUser.xp)

    if(rank > guildUser.rank) {
        ctx.reply(user, `you ranked up in **${ctx.discord_guild.name}!**
            Your rank is now **${rank}**`)

        guildUser.xp -= rankXP[rank - 1]
        guildUser.rank = rank
    }
}

const clean_trans = async (ctx, now) => {
    const transactionTime = asdate.subtract(new Date(), 10, 'days')
    const trClean = await Transaction.deleteMany({time: {$lt: transactionTime}})
    const aucClean = await Auction.deleteMany({time: {$lt: transactionTime}})
    if (trClean.n > 0 || aucClean.n > 0)
        console.log(`Cleaned ${trClean.n} transactions and ${aucClean.n} auctions`)
}

const bill_guilds = async (ctx, now) => {
    const guild = await Guild.findOne({nextcheck: {$lt: now}, lock: {$exists: true, $ne: ''}})

    if(!guild) return;
    console.log(guild.id)

    if(!guild.lockactive) {
        guild.nextcheck = asdate.add(new Date(), 24, 'hours')
        await guild.save()
        return
    }

    const report = []
    const total = guildLock.maintenance
    let ratio = guild.balance / total
    guild.balance = Math.max(0, guild.balance - total)

    if(ratio == Infinity)
        ratio = 0

    report.push(`Maintenance cost: **${numFmt(total)}** ${ctx.symbols.tomato}`)
    report.push(`Remaining guild balance: **${numFmt(guild.balance)}** ${ctx.symbols.tomato}`)

    if(ratio < 1) {
        guild.lockactive = false
        report.push(`> Lock has been disabled until next check`)
    } else {
        report.push(`> All costs were covered!`)
        if(guild.lock && !guild.lockactive) {
           report.push(`> Guild lock is back!`)
        }
        guild.lockactive = true
    }

    guild.nextcheck = asdate.add(new Date(), 24, 'hours')
    report.push(`Next check is in **${msToTime(guild.nextcheck - now, {compact: true})}**`)
    await guild.save()

    // m_hero.checkGuildLoyalty(isolatedCtx)

    const index = cache.findIndex(x => x.id === guild.id)
    cache[index] = guild

    if (guild.id === '651599467174428703')
        return ctx.send(guild.reportchannel || guild.lastcmdchannel || guild.botchannels[0], {
            author: { name: `Receipt for ${now}` },
            description: report.join('\n'),
            color: (ratio < 1? color.red : color.green),
        })
}

const getMaintenanceCost = (ctx) => {
    return ctx.guild.lock? guildLock.maintenance : 0
}

const getBuildingInfo = (ctx, user, args) => {
    const reg = new RegExp(args.join(''), 'gi')
    const item = ctx.items.filter(x => x.type === 'blueprint').find(x => reg.test(x.id))
    if(!item)
        return ctx.reply(user, `building with ID \`${args.join('')}\` was not found`, 'red')

    const building = ctx.guild.buildings.find(x => x.id === item.id)
    if(!building)
        return ctx.reply(user, `**${item.name}** is not built in this guild`, 'red')

    const embed = {
        description: item.fulldesc,
        fields: item.levels.map((x, i) => ({
            name: `Level ${i + 1}`, 
            value: `Price: **${numFmt(x.price)}** ${ctx.symbols.lemon}
                > ${x.desc.replace(/{currency}/gi, ctx.symbols.lemon)}`
    }))}

    const heart = building.health < 50? '💔' : '❤️'
    embed.color = color.blue
    embed.author = { name: item.name }
    embed.fields = embed.fields.slice(building.level - 1)
    embed.fields.push({ name: `Health`, value: `**${building.health}** ${heart}` })
    embed.fields[0].name += ` (current)`

    return ctx.send(ctx.msg.channel.id, embed, user.discord_id)
}

const getBuilding = (ctx, id) => ctx.guild.buildings.find(x => x.id === id && x.health > 50)

const getGuildUser = (ctx, user) => ctx.guild.userstats.find(x => x.id === user.discord_id)

const isUserOwner = (ctx, user) => ctx.msg.channel.guild.ownerID === user.discord_id

const fetchGuildUsers = (ctx) => User.find({ discord_id: {$in: ctx.guild.userstats.map(x => x.id) }})

const isUserManager = (ctx, user) => {
    const guildUser = ctx.guild.userstats.find(x => x.id === user.discord_id)
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
    isUserOwner,
    getMaintenanceCost,
    bill_guilds,
    getBuilding,
    guildLock,
    getBuildingInfo,
    isUserManager,
    dropCache,
    fetchOnly,
    fetchGuildUsers,
    clean_trans,
})
