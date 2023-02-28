const {cmd}             = require('../utils/cmd')
const colors            = require('../utils/colors')
const Announcement      = require('../collections/announcement')
const Kofi              = require('../collections/kofi')
const msToTime          = require('pretty-ms')
const _                 = require('lodash')
const pjson             = require('../package.json')
const { fetchOnly }     = require('../modules/user')
const asdate            = require('add-subtract-date')

const {
    withInteraction,
} = require("../modules/interactions")
const {formatDateTimeLong} = require("../utils/tools");

cmd('help', withInteraction(async (ctx, user) => {
    let sbj = 'general'
    const args = ctx.options.find(x => x.name === 'help_menu')
    if (args)
        sbj = args.value.toLowerCase()

    const help = ctx.help.find(x => x.type.includes(sbj))
    if(!help)
        return ctx.reply(user, `can't find help for \`${sbj}\``, 'red')

    const curpgn = getHelpEmbed(ctx, help)

    return ctx.interaction.createFollowup(curpgn)
})).access('dm')

cmd('rules', withInteraction(async (ctx, user) => {
    const help = ctx.help.find(x => x.type.includes('rules'))
    return ctx.interaction.createFollowup(getHelpEmbed(ctx, help))
})).access('dm')

cmd('report', withInteraction(async (ctx, user, args) => {
    if(user.ban && user.ban.report)
        return ctx.reply(user, `you have been banned from using this feature due to false reports or spamming. If you have a concern please visit our [support server](${ctx.cafe})!`, 'red')
    return ctx.interaction.createModal({
        title: "Bot Report/Suggestion Form",
        customID: "report",
        components: [
            {
                type: 1,
                components: [
                    {
                        type: 4,
                        customID: 'reportTitle',
                        label: 'Title',
                        style: 1,
                        minLength: 1,
                        maxLength: 512,
                        placeholder: 'A brief description can be placed here',
                        required: false
                    }
                ]
            },
            {
                type: 1,
                components: [
                    {
                        type: 4,
                        customID: 'reportBody',
                        label: 'Body',
                        style: 2,
                        minLength: 1,
                        maxLength: 4000,
                        placeholder: 'Type out your report/issue/concern here. Markdown formatting is supported.',
                        required: true
                    }
                ]
            }
        ]
    })
}, {modal: true})).access('dm')

cmd('kofi', withInteraction(async (ctx, user, args) => {
    if (!args.transID && !user.premium)
        return ctx.send(ctx.interaction, {
            title: 'Support Amusement Club!',
            description: 'Amusement Club has been provided free to use for over 5 years and the plan is to keep it that way. This Ko-Fi is purely to help support hosting costs and a coffee or two. ' +
                '**For $3 you can become a Amusement Plus* user for 30 days, currently all this does is grant you extra display features for your \`/profile\` and an extra role in the main support server and bot.**\n',

            url: ctx.config.links.kofi
        }, user.discord_id)
    if (!args.transID && user.premium)
        return ctx.reply(user, `thank you for your support! Your Amusement Plus will expire on **${formatDateTimeLong(user.premiumExpires)}**. 
        If you would like to extend your time, [click here](${ctx.config.links.kofi}) and re-up your time!`)
    const isLink = args.transID.startsWith('http')
    let query

    if (isLink)
        query = {transaction_id: args.transID.split('txid=').pop().split('&')[0]}
    else
        query = {transaction_id: args.transID}

    const isValid = await Kofi.findOne(query)

    if (!isValid)
        return ctx.reply(user, `there is no stored Ko-Fi payment with a transaction ID/link of \`${args.transID}\`.
        Make sure you are going to your order page and copying the URL, or the txid and pasting it here. 
        If you are sure you have done that then please reach out to either the email provided on the order page, or contact us in our [discord](${ctx.cafe})`, 'red')

    const months = Math.ceil(isValid.amount / 3)
    if (months === 0)
        return ctx.reply(user, `thank you for your donation to Amusement Club servers! The amount registered in this transaction is below the amount required for 1 month of Amusement Plus, so it will not be granted. 
        If you make another donation within the next 30 days that grants you access please contact us in our [support server](${ctx.cafe})`)

    user.premium = true
    const alreadyPremium = user.premiumExpires
    user.premiumExpires = asdate.add(alreadyPremium? alreadyPremium: new Date(), months, 'months')

    if (!user.roles.some(x => x === 'AmuPlus'))
        user.roles.push('AmuPlus')

    await user.save()
    await Kofi.deleteOne(isValid)
    return ctx.reply(user, `congratulations! You have successfully claimed **${months}** months of Amusement Plus! Your Amusement Plus will expire on ${formatDateTimeLong(user.premiumExpires)}.`)

}, {ephemeral: true}))

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
        description: `Please, read terms and conditions of using bot on your server by viewing [our site](https://docs.amusement.cafe/)
            After that [click here](${ctx.invite}) to invite the bot.`,
        color: colors.green
    }

    return ctx.send(ctx.interaction, embed, user.discord_id)
}))

cmd('license', withInteraction(async (ctx, user) => {
    const embed = {
        title: `Code License`,
        description: `This bot's source code is (or parts of it are) provided freely by noxc#4905, Mj11jM#1111, and contributors under the [MPL-2.0 Licence](https://github.com/Amusement-Cafe/amusementclub2.0/blob/master/LICENSE)
        To view the source code of the main project, [click here](https://github.com/Amusement-Cafe/amusementclub2.0)
        If you are using some or part of the code for this bot in your works, some semi-public attribution may be required. 
        Leaving this command in and in help untouched, can count as such.`,
        color: colors.green
    }
    return ctx.send(ctx.interaction, embed, user.discord_id)
})).access('dm')

const getHelpEmbed = (ctx, o) => {

    const footerText = `Amusement Club Bort | xQAxThF | v${pjson.version} | by noxc#4905 and Mj11jM#1111`
    return {
        embeds: [{
            title: `\u2B50 Amusement Club \u2B50 Card Game Help`,
            description: `This help command has been deprecated as of 04/22. You can now find all of our command documentation on our website, just click the button below!
            ${o.docs ? `The button below will link you to the site entry related to your help request.` : ``}`,
            footer: {text: footerText},
            color: colors['green']
        }],
        components: [
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 5,
                        label: `Documentation Page`,
                        url: o.docs ? `https://docs.amusement.cafe/${o.docs}` : `https://docs.amusement.cafe/`
                    }
                ]
            }
        ]
    }

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
