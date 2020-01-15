const {cmd}             = require('../utils/cmd')
const {XPtoLEVEL}       = require('../utils/tools')
const color             = require('../utils/colors')
const {addConfirmation} = require('../utils/confirmator')
const msToTime          = require('pretty-ms')

const {
    rankXP,
    addGuildXP,
    getMaintenanceCost,
    isUserOwner
} = require('../modules/guild')

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
            return `\`${item.id}\` **${item.name} level ${x.level}** [\`❤️\` ${x.health}] (${item.desc})`
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

    const resp = [], buildings = []
    const cost = Math.round(getMaintenanceCost(ctx) * (castle.level < 3? 1 : (castle.level < 5? .9 : .75)))

    resp.push(`Building maintenance: **${cost}** {currency}/day`)
    resp.push(`Current finances: **${ctx.guild.balance}** {currency}`)
    resp.push(`Ratio: **${cost / ctx.guild.balance}** (${cost / ctx.guild.balance < 0? 'positive' : 'negative'})`)
    resp.push(`Maintenance charges in **${msToTime(60000, {compact: true})}**`)
    resp.push(`> Make sure you have **positive** ratio when maintenance costs are charged`)

    return ctx.send(ctx.msg.channel.id, {
        author: { name: ctx.discord_guild.name },
        description: resp.join('\n'),
        fields: [{name: `Maintenance breakdown`, value: ctx.guild.buildings.map(x => {
            const item = ctx.items.filter(y => y.id === x.id)[0]
            return `**${item.name}** level **${x.level}** costs **${item.levels[x.level - 1].maintenance}** {currency}/day`
        }).join('\n')}],
        color: color.blue
    }, user.discord_id)
})

cmd(['guild', 'upgrade'], async (ctx, user, arg1) => {
    if(!arg1)
        return ctx.reply(user, 'please specify building ID', 'red')

    const building = ctx.guild.buildings.filter(x => x.id === arg1)[0]
    const item = ctx.items.filter(x => x.id === arg1)[0]

    if(!building)
        return ctx.reply(user, `building with ID \`${arg1}\` not found`, 'red')

    const level = item.levels[building.level]

    if(!level)
        return ctx.reply(user, `**${item.name}** is already max level`, 'red')

    if(user.exp < level.price)
        return ctx.reply(user, `you have to have at least **${level.price}** {currency} to upgrade this building`, 'red')

    const question = `Do you want to upgrade **${item.name}** to level **${building.level + 1}** for **${level.price}** {currency}?`
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

    if(castle.level < 3 && tax > 5)
        return ctx.reply(user, `maximum allowed tax for current level is **5%**`, 'red')

    if(castle.level < 5 && tax > 10)
        return ctx.reply(user, `maximum allowed tax for current level is **10%**`, 'red')

    if(castle.level < 3 && tax > 25)
        return ctx.reply(user, `maximum allowed tax for current level is **25%**`, 'red')

    ctx.guild.tax = tax * .01
    await ctx.guild.save()

    return ctx.reply(user, `guild claim tax was set to **${tax}%**`)
})