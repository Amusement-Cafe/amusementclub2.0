const {cmd}     = require('../utils/cmd')
const colors    = require('../utils/colors')

const {
    withInteraction,
} = require("../modules/interactions")

const desc = {
    aucbidme: `someone bid on your auction`,
    aucoutbid: `someone outbid you on the auction`,
    aucend: `your auction has finished`,
    aucnewbid: `when a current highest bidder in your auction gets outbid`,
    announce: `there is a new bot announcement`,
    daily: `you can claim your daily`,
    vote: `you can vote for the bot`,
    completed: `when you complete, or lose completion on a collection`,
    effectend: `when one of your passive effects has expired`,
    canhas: `use the \`/has\` command on you`,
    cansell: `sell you cards`,
    candiff: `use \`/diff\` commands on you`,
}

cmd(['preferences', 'show', 'all'], withInteraction((ctx, user) => {
    const cats = []
    cats.push(`\`notify\` **Notifications** (set events that bot can DM you about)`)
    cats.push(`\`interact\` **Interactions** (Set how you interact with others in the bot)`)

    return ctx.reply(user, {
        title: `My Preferences`,
        color: colors.deepgreen,
        description: `available preferences (use \`${ctx.prefix}preferences show\`):\n${cats.join('\n')}`,
    })
})).access('dm')

cmd(['preferences', 'show', 'notify'], withInteraction((ctx, user) => {
    const notify = user.prefs.notifications
    const fields = Object.keys(notify).map(x => {
        if(desc.hasOwnProperty(x)) {
            return `\`${notify[x]? ctx.symbols.accept : ctx.symbols.decline} ${x}\` ${desc[x]}`
        }
    }).filter(x => x)

    return ctx.send(ctx.interaction, {
        title: `Notification Preferences`,
        color: colors.deepgreen,
        description: `Get a DM notification when:\n${fields.join('\n')}\n\n
            Use \`${ctx.prefix}preferences set notify\``,
    })
})).access('dm')

cmd(['preferences', 'set', 'notify'], withInteraction(async (ctx, user, args) => {
    const notify = user.prefs.notifications
    if(!notify.hasOwnProperty(args.option)) {
        return ctx.reply(user, `notify setting \`${args.option}\` doesn't exist.`, 'red')
    }

    let enable = !user.prefs.notifications[args.option]

    if(enable) {
        try {
            await ctx.direct(user, `this is a test notification. If you are reading this it means that direct messages are working fine!`)
        } catch (e) {
            return ctx.reply(user, `cannot enable DM notifications. 
                Make sure you have 'Allow direct messages from server members' enabled in privacy settings of the server with the bot`, 'red')
        }
    }

    user.prefs.notifications[args.option] = enable
    await user.save()

    return ctx.reply(user, `preferences saved. You will ${enable? 'now' : '**not**'} get DM notifications when **${desc[args.option]}**`)
})).access('dm')

cmd(['preferences', 'show', 'interact'], withInteraction((ctx, user) => {
    const interact = user.prefs.interactions
    const fields = Object.keys(interact).map(x => {
        if(desc.hasOwnProperty(x)) {
            return `\`${interact[x]? ctx.symbols.accept : ctx.symbols.decline} ${x}\` ${desc[x]}`
        }
    }).filter(x => x)

    return ctx.send(ctx.interaction, {
        title: `Interaction Preferences`,
        color: colors.deepgreen,
        description: `Allow or disallow other users to:\n${fields.join('\n')}\n\n
            Use \`${ctx.prefix}preferences set interact\``,
    })
})).access('dm')

cmd(['preferences', 'set', 'interact'], withInteraction(async (ctx, user, args) => {
    const interact = user.prefs.interactions
    if(!interact.hasOwnProperty(args.option)) {
        return ctx.reply(user, `interact setting \`${args.option}\` doesn't exist.`, 'red')
    }

    let enable = !user.prefs.interactions[args.option]

    user.prefs.interactions[args.option] = enable
    await user.save()

    return ctx.reply(user, `preferences saved. Other users are now ${enable? '': 'not'} able to **${desc[args.option]}**`)
})).access('dm')
