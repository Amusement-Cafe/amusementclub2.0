const {cmd}             = require('../utils/cmd')
const {XPtoLEVEL}       = require('../utils/tools')
const color             = require('../utils/colors')
const {addConfirmation} = require('../utils/confirmator')
const msToTime          = require('pretty-ms')

const {
    rankXP,
    addGuildXP,
    getMaintenanceCost,
    isUserOwner,
    getGuildUser
} = require('../modules/guild')

cmd(['guild'], async (ctx, user) => {
    const help = ctx.help.filter(x => x.type.includes('guild'))[0]
    return ctx.send(ctx.msg.channel.id, {
        author: { name: `Possible options:` },
        fields: help.fields.map(x => ({ name: x.title, value: x.description })),
        color: color.blue
    }, user.discord_id)
})

cmd(['guild', 'info'], async (ctx, user) => {
    const resp = [], userstat = [], fields = []
    resp.push(`Level: **${XPtoLEVEL(ctx.guild.xp)}**`)
    resp.push(`Players: **${ctx.guild.userstats.length}/${ctx.discord_guild.memberCount}**`)
    resp.push(`Prefix: \`${ctx.guild.prefix}\``)
    resp.push(`Claim tax: **${Math.round(ctx.guild.tax * 100)}%**`)
    resp.push(`Building permissions: **Rank ${ctx.guild.buildperm}+**`)

    const curUser = ctx.guild.userstats.filter(x => x.id === user.discord_id)[0]
    if(curUser){
        userstat.push(`Current rank: **${curUser.rank}**`)
        userstat.push(`Progress to the next rank: **${Math.round((curUser.xp / rankXP[curUser.rank]) * 100)}%**`)
    } else {
        userstat.push(`You don't have statistics in this guild`)
    }

    fields.push({ name: `Your guild stats`, value: userstat.join('\n') })

    if(ctx.guild.buildings.length > 0)
        fields.push({ name: `Buildings`, value: ctx.guild.buildings.map(x => {
            const item = ctx.items.filter(y => y.id === x.id)[0]
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
    const castle = ctx.guild.buildings.filter(x => x.id === 'castle')[0]
    if(!castle)
        return ctx.reply(user, 'status check only possible in guild that has **Guild Castle**', 'red')

    const resp = []
    const cost = getMaintenanceCost(ctx)
    const ratio = cost / ctx.guild.balance

    resp.push(`Building maintenance: **${cost}** ${ctx.symbols.tomato}/day`)
    resp.push(`Current finances: **${ctx.guild.balance}** ${ctx.symbols.tomato}`)
    resp.push(`Ratio: **${ratio.toFixed(2)}** (${ratio < 1? 'positive' : 'negative'})`)
    resp.push(`Maintenance charges in **${msToTime(ctx.guild.nextcheck - new Date(), {compact: true})}**`)
    resp.push(`> Make sure you have **positive** ratio when maintenance costs are charged`)

    return ctx.send(ctx.msg.channel.id, {
        author: { name: ctx.discord_guild.name },
        description: resp.join('\n'),
        fields: [{name: `Maintenance breakdown`, value: ctx.guild.buildings.map(x => {
            const item = ctx.items.filter(y => y.id === x.id)[0]
            const heart = x.health < 50? '💔' : '❤️'
            return `[\`${heart}\` ${x.health}] **${item.name}** level **${x.level}** costs **${item.levels[x.level - 1].maintenance}** ${ctx.symbols.tomato}/day`
        }).join('\n')}],
        color: (ratio < 1? color.green : color.red)
    }, user.discord_id)
})

cmd(['guild', 'upgrade'], async (ctx, user, arg1) => {
    if(!arg1)
        return ctx.reply(user, 'please specify building ID', 'red')

    if(!isUserOwner(ctx, user) && getGuildUser(ctx, user).rank < ctx.guild.buildperm)
        return ctx.reply(user, `you have to be at least rank **${ctx.guild.buildperm}** to upgrade buildings in this guild`, 'red')

    const building = ctx.guild.buildings.filter(x => x.id === arg1)[0]
    const item = ctx.items.filter(x => x.id === arg1)[0]

    if(!building)
        return ctx.reply(user, `building with ID \`${arg1}\` not found`, 'red')

    const level = item.levels[building.level]

    if(XPtoLEVEL(ctx.guild.xp) < level.level)
        return ctx.reply(user, `this guild has to be at least level **${item.levels[0].level}** to have **${item.name} level ${level.level}**`, 'red')

    if(!level)
        return ctx.reply(user, `**${item.name}** is already max level`, 'red')

    if(user.exp < level.price)
        return ctx.reply(user, `you have to have at least **${level.price}** ${ctx.symbols.tomato} to upgrade this building`, 'red')

    const question = `Do you want to upgrade **${item.name}** to level **${building.level + 1}** for **${level.price}** ${ctx.symbols.tomato}?`
    addConfirmation(ctx, user, question, null, async (x) => {

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

    }, (x) => ctx.reply(user, 'upgrade was cancelled', 'red'))
})

cmd(['guild', 'set', 'tax'], async (ctx, user, arg1) => {
    const tax = Math.abs(parseInt(arg1))
    const castle = ctx.guild.buildings.filter(x => x.id === 'castle')[0]

    if(!castle)
        return ctx.reply(user, '**Guild Castle** is required to set claim tax', 'red')

    if(!isUserOwner(ctx, user) && !user.roles.includes('admin'))
        return ctx.reply(user, `only server owner can modify guild tax`, 'red')

    if(!tax)
        return ctx.reply(user, `please specify a number that indicates % of claim tax`, 'red')

    if(castle.level < 2 && tax > 5)
        return ctx.reply(user, `maximum allowed tax for current level is **5%**`, 'red')

    if(castle.level < 4 && tax > 25)
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
