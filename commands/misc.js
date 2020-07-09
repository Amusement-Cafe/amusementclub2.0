const {cmd} = require('../utils/cmd')
const colors = require('../utils/colors')
const msToTime  = require('pretty-ms')
const { arrayChunks } = require('../utils/tools')

cmd('help', async (ctx, user, ...args) => {
    let sbj = 'general'
    let sendHere = false

    args.map(x => {
        if(x === '-here') sendHere = true
        else sbj = x
    })

    const help = ctx.help.find(x => x.type.includes(sbj))
    if(!help)
        return ctx.reply(user, `can't find help for \`${sbj}\``, 'red')

    if(sendHere){
        return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, getHelpEmbed(ctx, help, `->`))

    } else {
        try {
            const ch = await ctx.bot.getDMChannel(user.discord_id)
            await ctx.pgn.addPagination(user.discord_id, ch.id, getHelpEmbed(ctx, help, `->`))

            if(ch.id != ctx.msg.channel.id)
                await ctx.reply(user, 'help was sent to you')
        } catch (e) {
            await ctx.reply(user, `please make sure you have **Allow direct messages from server members** enabled in server privacy settings.
                You can do it in any server that you share with bot`, 'red')
        }
    }
}).access('dm')

cmd('rules', async (ctx, user) => {
    const help = ctx.help.find(x => x.type.includes('rules'))
    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, getHelpEmbed(ctx, help, `->`))
}).access('dm')

cmd('baka', async (ctx, user, ...args) => {
    const time = msToTime(Date.now() - new Date(ctx.msg.timestamp))
    return ctx.reply(user, `you baka in \`${time}\``)
})

const getHelpEmbed = (ctx, o, prefix) => {

    const footerText = `Amusement Club Alexandrite | xQAxThF | v0.1.0 BETA | by NoxCaos#4905`
    const embed = {
        title: o.title, 
        description: o.description.replace(/->/g, prefix), fields: [],
        footer: { text: footerText },
        color: colors['green']
    }

    const pages = arrayChunks(o.fields.map((x) => ({ name: x.title, inline: x.inline, value: x.description.replace(/->/g, prefix)})), 5)
    return {
        pages, embed,
        buttons: ['back', 'forward'],
        switchPage: (data) => { 
            data.embed.fields = data.pages[data.pagenum]
            data.embed.footer.text = `- Page ${data.pagenum + 1}/${pages.length} - | ${footerText}`
        }
    }

    return e
}
