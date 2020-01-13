const {cmd}         = require('../utils/cmd')
const {rankXP}      = require('../modules/guild')
const {XPtoLEVEL}   = require('../utils/tools')
const color         = require('../utils/colors')

cmd(['guild', 'info'], async (ctx, user) => {
    const resp = [], userstat = [], fields = []
    resp.push(`Level: **${XPtoLEVEL(ctx.guild.xp)}**`)
    resp.push(`Players: **${ctx.guild.userstats.length}/${ctx.discord_guild.memberCount}**`)
    resp.push(`Prefix: \`${ctx.guild.prefix}\``)
    resp.push(`Building permissions: **Rank ${ctx.guild.buildperm}+**`)

    const curUser = ctx.guild.userstats.filter(x => x.id === user.discord_id)[0]
    if(curUser){
        userstat.push(`Current rank: **${curUser.rank}**`)
        userstat.push(`Progress to the next rank: **${(curUser.xp / rankXP[curUser.rank]) * 100}%**`)
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

cmd(['guild', 'upgrade'], async (ctx, user, item) => {
    
})