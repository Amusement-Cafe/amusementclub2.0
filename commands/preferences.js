const {cmd}     = require('../utils/cmd')
const colors    = require('../utils/colors')
const _         = require('lodash')

const {
    withInteraction,
} = require("../modules/interactions")

const {
    withCards,
    formatName,
} = require('../modules/card')

const {
    findUserCards,
} = require("../modules/user")

const {
    bestColMatch,
} = require("../modules/collection")

const desc = {
    aucbidme: `someone bid on your auction`,
    aucoutbid: `someone outbid you on the auction`,
    aucend: `your auction has finished`,
    aucnewbid: `when a current highest bidder in your auction gets outbid`,
    announce: `there is a new bot announcement`,
    daily: `you can claim your daily`,
    vote: `you can vote for the bot`,
    completed: `when you complete, or lose completion on a collection`,
    effectend: `when an effect expires or comes off cooldown`,
    canhas: `use the \`/has\` command on you`,
    cansell: `sell you cards`,
    candiff: `use \`/diff\` commands on you`,
    bio: `set a custom bio`,
    title: `set a title to display`,
    color: `set a custom color`,
    card: `set a favorite card to display`,
    favcomplete: `set a favorite complete collection`,
    favclout: `set a favorite clouted collection`,
}

const premium = {
    color: true,
    card: true,
    favcomplete: true,
    favclout: true,
}

cmd(['preferences', 'show', 'all'], withInteraction((ctx, user) => {
    const cats = []
    cats.push(`\`notify\` **Notifications** (set events that bot can DM you about)`)
    cats.push(`\`interact\` **Interactions** (Set how you interact with others in the bot)`)
    cats.push(`\`profile\` **Profile** (Change how your profile is displayed)`)

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

cmd(['preferences', 'show', 'profile'], withInteraction((ctx, user) => {
    const profile = user.prefs.profile
    const fields = Object.keys(profile).map(x => {
        if(desc.hasOwnProperty(x)) {
            if (premium[x] && !user.premium)
                return `Custom \`${x}\` set? ${ctx.symbols.amu_plus}`
            if (x === 'bio')
                return `Custom \`${x}\` set? \`${profile[x] == 'This user has not set a bio'? ctx.symbols.decline: ctx.symbols.accept}\``
            if (x === 'color')
                return `Custom \`${x}\` set? \`${profile[x] == '16756480'? ctx.symbols.decline: ctx.symbols.accept}\``

            return `Custom \`${x}\` set? \`${profile[x]? ctx.symbols.accept : ctx.symbols.decline}\``

        }
    }).filter(x => x)

    return ctx.send(ctx.interaction, {
        title: `Profile Preferences`,
        color: colors.deepgreen,
        description: `Do you have a:\n${fields.join('\n')}\n\n
            Use \`${ctx.prefix}preferences set profile\``,
        footer: {
            text: `${!user.premium? `Entries with the Amusement Plus emoji require an Amusement Plus account, see /kofi for information`: ''}`
        }
    })
})).access('dm')

cmd(['preferences', 'set', 'profile'], withInteraction(withCards(async (ctx, user, cards, args) => {
    const profile = user.prefs.profile
    const argumentless = ['card', 'title']
    if(!profile.hasOwnProperty(args.option.toLowerCase())) {
        return ctx.reply(user, `profile setting \`${args.option}\` doesn't exist.`, 'red')
    }

    if (premium[args.option.toLowerCase()] && !user.premium)
        return ctx.reply(user, `this setting is only available to premium users! For more information about how to become a premium user, check out \`/kofi\` ***without arguments***!`)

    if (!argumentless.some(x => x === args.option.toLowerCase()) && !args.extraArgs)
        return ctx.reply(user, `an extra argument is required for this option! Please make sure it is filled in and try again!`, 'red')



    let resp = ''
    switch (args.option.toLowerCase()) {
        case 'card':
            const userCard = await findUserCards(ctx, user, cards.map(x => x.cardid))
            if (!userCard || userCard.length === 0)
                return ctx.reply(user, `you can only set a favorite card to one you own!`, 'red')
            profile.card = cards[0].id
            resp = `you have set your profile display card as ${formatName(ctx.cards[cards[0].id])}!`
            break;
        case 'color':
            if (isNaN(Number(args.extraArgs)))
                return ctx.reply(user, `discord only takes decimal numbers, as such this argument only takes numbers between 1 and 16777215!`, 'red')
            profile.color = args.extraArgs
            resp = `you have set your color to the decimal value **${args.extraArgs}**! You can check the color [here](https://convertingcolors.com/decimal-color-${args.extraArgs}.html)!
            If that link displays something wrong, your color will also not work. Please be sure to use the Decimal value in the right column!`
            break;
        case 'bio':
            if (args.extraArgs.length > 140)
                return ctx.reply(user, `you have submitted too long of a bio! Please keep your bio below 140 characters!`, 'red')
            if (args.extraArgs.includes('www') || args.extraArgs.includes('http'))
                return ctx.reply(user, `links to external websites are disallowed in bio's!`, 'red')
            if (ctx.filter.isProfane(args.extraArgs))
                return ctx.reply(user, `your chosen bio contains words disallowed in this bot!`, 'red')
            profile.bio = args.extraArgs
            resp = `you have set your bio to:\n**${args.extraArgs}**`
            break;
        case 'title':
            let options = []
            const availableTitles = ctx.achievements.filter(x => user.achievements.some(y => y === x.id) && x.title)?.map(x => {
                return {title: x.title, id: x.id}
            })
            if (!availableTitles || availableTitles.length === 0)
                return ctx.reply(user, `you have no achievements that grant titles!`, 'red')
            const titleList = _.chunk(availableTitles, 25)
            titleList.map(x => {
                options.push({
                    type: 1,
                    components: [
                        {
                            type: 3,
                            customID: 'title_select',
                            options: x.map(y => {
                                return {
                                    label: y.title.replace('{name}', user.username),
                                    value: y.id,
                                }
                            }),
                            placeholder: "Please select a title",
                            maxValues: 1
                        }
                    ]
                })
            })
            return ctx.send(ctx.interaction, {
                title: 'Please select a title from the selection menu below',
                color: colors.blue
            }, null, options)
            break;
        case 'favcomplete':
            const bestCol = bestColMatch(ctx, args.extraArgs)
            if (!bestCol || !user.completedcols.some(x => x.id === bestCol.id))
                return ctx.reply(user, `you do not have \`${args.extraArgs}\` completed! Check your spelling and completion and try again!`, 'red')
            profile.favcomplete = args.extraArgs
            resp = `your favorite completion has been set to \`${bestCol.id}\`!`
            break;
        case 'favclout':
            const cloutCol = bestColMatch(ctx, args.extraArgs)
            if (!cloutCol || !user.cloutedcols.some(x => x.id === cloutCol.id))
                return ctx.reply(user, `you do not have \`${args.extraArgs}\` clouted! Check your spelling and try again!`, 'red')
            profile.favclout = args.extraArgs
            resp = `your favorite clout has been set to \`${cloutCol.id}\`!`
            break;
    }

    await user.save()

    return ctx.reply(user, resp)
}))).access('dm')
