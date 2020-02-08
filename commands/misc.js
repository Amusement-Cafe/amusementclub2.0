const {cmd} = require('../utils/cmd')
const colors = require('../utils/colors')
const msToTime  = require('pretty-ms')

cmd('help', async (ctx, user, ...args) => {
    let sbj = 'general'
    let sendHere = false

    args.map(x => {
        if(x === '-here') sendHere = true
        else sbj = x
    })

    const help = ctx.help.filter(x => x.type.includes(sbj))[0]
    if(!help)
        return ctx.reply(user, `can't find help for \`${sbj}\``, 'red')

    if(sendHere){
        await ctx.send(ctx.msg.channel.id, getHelpEmbed(help, `->`), user.discord_id)

    } else {
        try {
            const ch = await ctx.bot.getDMChannel(user.discord_id)
            await ctx.send(ch.id, getHelpEmbed(help, `->`), user.discord_id)

            if(ch.id != ctx.msg.channel.id)
                await ctx.reply(user, 'help was sent to you')
        } catch (e) {
            await ctx.reply(user, `please make sure you have **Allow direct messages from server members** enabled in server privacy settings.
                You can do it in any server that you share with bot`, 'red')
        }
    }
})

cmd('rules', async (ctx, user) => {
    const help = ctx.help.filter(x => x.type.includes('rules'))[0]
    return ctx.send(ctx.msg.channel.id, getHelpEmbed(help, `->`), user.discord_id)
})

cmd('baka', async (ctx, user, ...args) => {
    const time = msToTime(Date.now() - new Date(ctx.msg.timestamp))
    return ctx.reply(user, `you baka in \`${time}\``)
})

const getHelpEmbed = (o, prefix) => {
    const e = {
        title: o.title, 
        description: o.description.replace(/->/g, prefix), fields: [],
        footer: { text: `Amusement Club 2.0 | xQAxThF | v2.0 BETA | by NoxCaos#4905` },
        color: colors['green']
    }

    o.fields.map((x) => {
       e.fields.push({ name: x.title, inline: x.inline, value: x.description.replace(/->/g, prefix)})
    })

    return e
}
