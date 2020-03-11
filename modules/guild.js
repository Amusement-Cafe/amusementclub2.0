const Guild         = require('../collections/guild')
const Transaction   = require('../collections/transaction')
const Auction       = require('../collections/auction')

const color         = require('../utils/colors')
const asdate        = require('add-subtract-date')
const msToTime      = require('pretty-ms')

const {
    checkGuildLoyalty
} = require('./hero')

const cache = []

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

const addGuildXP = (ctx, user, xp) => {
    let guildUser = ctx.guild.userstats.find(x => x.id === user.discord_id)
    
    if(!guildUser) {
        guildUser = { id: user.discord_id, xp: 0, rank: 0 }
        ctx.guild.userstats.push(guildUser)

        if(user.xp > 10) {
            const warning = `\nPlease be aware that your claims are **${Math.round(ctx.guild.tax * 100)}%** more expensive here`
            ctx.reply(user, `welcome to **${ctx.discord_guild.name}!** ${ctx.guild.tax > 0? warning : ''}
                For more information run \`->guild info\``)
        }
    }

    ctx.guild.xp += xp * .02
    guildUser.xp += xp
    const rank = XPtoRANK(guildUser.xp)

    if(rank > guildUser.rank)
        ctx.reply(user, `you ranked up in **${ctx.discord_guild.name}!**
            Your rank is now **${rank}**`)

    guildUser.rank = rank
}

const bill_guilds = async (ctx, now) => {
    const guild = await Guild.findOne({nextcheck: {$lt: now}, buildings: {$exists: true, $ne: []}})
    if(!guild) return;

    const report = []
    const isolatedCtx = Object.assign({}, ctx, { guild, discord_guild: ctx.bot.guilds.find(x => x.id === guild.id) })
    const cost = getMaintenanceCost(isolatedCtx)
    const ratio = guild.balance / cost
    guild.balance = Math.max(0, guild.balance - cost)

    report.push(`Maintenance cost: **${cost}** ${ctx.symbols.tomato}`)
    report.push(`Remaining guild balance: **${guild.balance}** ${ctx.symbols.tomato}`)

    if(ratio < 1) {
        const damage = Math.round(10 * (1 - ratio))
        guild.buildings.map(x => x.health -= damage)
        guild.lockactive = false
        report.push(`> Negative ratio resulted all buildings taking **${damage}** points of damage. The building will stop functioning if health goes lower than 50%`)
        if(guild.lock)
            report.push(`> Lock has been disabled until next check`)
        
    } else {
        guild.buildings.map(x => x.health = Math.min(x.health + (x.health < 50? 10 : 5), 100))
        report.push(`> All costs were covered! Positive ratio healed buildings by **5%**`)
        if(guild.lock && !guild.lockactive) {
           report.push(`> Guild lock is back!`)
        }
        guild.lockactive = true
    }

    guild.nextcheck = asdate.add(new Date(), 12, 'hours')
    report.push(`Next check is in **${msToTime(guild.nextcheck - now, {compact: true})}**`)
    await guild.save()

    const transcleanup = asdate.subtract(new Date(), 15, 'days')
    const auccleanup = asdate.subtract(new Date(), 5, 'days')
    const res1 = await Transaction.deleteMany({time: {$lt: transcleanup}, guild_id: guild.id})
    const res2 = await Auction.deleteMany({time: {$lt: auccleanup}, guild: guild.id})

    checkGuildLoyalty(isolatedCtx)

    const index = cache.findIndex(x => x.id === guild.id)
    cache[index] = guild

    return ctx.send(guild.reportchannel, {
        author: { name: `Receipt for ${now}` },
        description: report.join('\n'),
        color: (ratio < 1? color.red : color.green),
        fields: [{
            name: `Cleaned in this guild`,
            value: `**${res1.n}** transactions\n**${res2.n}** auctions`
        }]
    })
}

const getMaintenanceCost = (ctx) => { 
    let reduce = 1
    const castle = ctx.guild.buildings.find(x => x.id === 'castle')
    if(castle)
        reduce = (castle.level < 3? 1 : (castle.level < 5? .9 : .7))

    const buildings = ctx.guild.buildings.map(x => ctx.items.find(y => y.id === x.id).levels[x.level - 1].maintenance).reduce((a, b) => a + b, 0)
    const lockprice = ctx.guild.lock? guildLock.maintenance : 0
    return Math.round((buildings + lockprice) * reduce)
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
            value: `Price: **${x.price}** ${ctx.symbols.tomato}
                Maintenance: **${x.maintenance}** ${ctx.symbols.tomato}/day
                Required guild level: **${x.level}**
                > ${x.desc.replace(/{currency}/gi, ctx.symbols.tomato)}`
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

const isUserManager = (ctx, user) => {
    const guildUser = ctx.guild.userstats.find(x => x.id === user.discord_id)
    return (guildUser && guildUser.roles.includes('manager'))
}

const rankXP = [10, 100, 500, 2500, 10000]

const XPtoRANK = (xp) => rankXP.filter(x => xp > x).length

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
    isUserManager
})
