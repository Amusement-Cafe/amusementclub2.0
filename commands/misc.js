const {cmd}             = require('../utils/cmd')
const colors            = require('../utils/colors')
const Announcement      = require('../collections/announcement')
const msToTime          = require('pretty-ms')
const _                 = require('lodash')
const pjson             = require('../package.json')
const { fetchOnly }     = require('../modules/user')

const {
    withInteraction,
} = require("../modules/interactions")

cmd('help', withInteraction(async (ctx, user) => {
    let sbj = 'general'
    const args = ctx.options.find(x => x.name === 'help_menu')
    if (args)
        sbj = args.value.toLowerCase()

    const help = ctx.help.find(x => x.type.includes(sbj))
    if(!help)
        return ctx.reply(user, `can't find help for \`${sbj}\``, 'red')

    const curpgn = getHelpEmbed(ctx, help)

    return ctx.interaction.createMessage(curpgn)
})).access('dm')

cmd('rules', withInteraction(async (ctx, user) => {
    const help = ctx.help.find(x => x.type.includes('rules'))
    return ctx.sendPgn(ctx, user, getHelpEmbed(ctx, help, `->`))
})).access('dm')

cmd('announcement', withInteraction(async (ctx, user) => {
    const announcement = (await Announcement.find().sort({ date: -1 }))[0]
    if (!announcement)
        return ctx.reply(user, `an announcement cannot currently be found. please try again later!`, 'red')
    return ctx.reply(user, {
        author: { name: `Latest Announcement: ` + announcement.title },
        description: announcement.body
    }, 'blue')
})).access('dm')

cmd('baka', withInteraction(async (ctx, user, ...args) => {
    return
    const time = msToTime(Date.now() - new Date(ctx.interaction.timestamp))
    return ctx.reply(user, `you baka in \`${time}\``)
}))

cmd('pat', withInteraction(async (ctx, user, args) => {
    const otherid = args.ids[0]
    if(!otherid) return

    const otheruser = await fetchOnly(otherid)
    if(!otheruser) return ctx.reply(user, `you can't pat people who aren't bot players!`, 'red')

    const embed = { 
        description: `**${user.username}** pats **${otheruser.username}** ${_.sample(pats)}`,
        color: Math.floor(Math.random() * 16777215)
    }
    return ctx.send(ctx.interaction, embed, user.discord_id)
}))

cmd('invite', withInteraction(async (ctx, user) => {
    const embed = { 
        title: `Invite Amusement Club`,
        description: `Please, read terms and conditions of using bot on your server by typing \`->help invite\` 
            After that [click here](${ctx.invite}) to invite the bot.`,
        color: colors.green
    }

    return ctx.send(ctx.interaction, embed, user.discord_id)
}))

cmd('license', withInteraction(async (ctx, user) => {
    const embed = {
        title: `Code License`,
        description: `This bot's source code (or parts of it) is provided freely by NoxCaos#4905 and contributors under the [MPL-2.0 Licence](https://github.com/Amusement-Cafe/amusementclub2.0/blob/master/LICENSE)
        To view the source code of the main project, [click here](https://github.com/Amusement-Cafe/amusementclub2.0)
        If you are using some or part of the code for this bot in your works, some semi-public attribution may be required. 
        Leaving this command in and in help untouched, can count as such.`,
        color: colors.green
    }
    return ctx.send(ctx.interaction, embed, user.discord_id)
})).access('dm')

const getHelpEmbed = (ctx, o) => {

    const footerText = `Amusement Club Bort | xQAxThF | v${pjson.version} | by noxc#4905 and Mj11jM#1111`
    const newHelp = {
        embed: {
            title: `\u2B50 Amusement Club \u2B50 Card Game Help`,
            description: `This help command has been deprecated as of 04/22. You can now find all of our command documentation on our website, just click the button below!
            ${o.docs? `The button below will link you to the site entry related to your help request.`: ``}`,
            footer: { text: footerText },
            color: colors['green']
        },
        components: [
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 5,
                        label: `Documentation Page`,
                        url: o.docs? `https://docs.amusement.cafe/${o.docs}`: `https://docs.amusement.cafe/`
                    }
                ]
            }
        ]
    }
    return newHelp

}

const pats = [
    '(；^＿^)ッ☆(　゜o゜)',
    '(　´Д｀)ﾉ(´･ω･`)　ﾅﾃﾞﾅﾃﾞ',
    '(*￣▽￣)ノ”(^ー^*)',
    '(*￣▽￣)ノ”(- -*)',
    '(*￣▽￣)ノ”(ﾟ∇ﾟ*)',
    '(*￣▽￣)ノ”(ﾟーﾟ*)',
    '(*’-’)ノ”(^o^*)',
    '(ｏ・_・)ノ”(ᴗ_ ᴗ。)',
    '(*´・ω・)ノ(-ω-｀*)',
    '(o・_・)ノ”(ノ_＜。)'
]

module.exports = {
    getHelpEmbed
}
