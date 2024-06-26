const msToTime          = require('pretty-ms')
const {cmd}             = require('../utils/cmd')
const colors            = require('../utils/colors')
const UserQuest         = require("../collections/userQuest")
const asdate            = require('add-subtract-date')
const _                 = require('lodash')
const AsciiTable        = require("ascii-table")

const {
    cap,
    claimCost,
    numFmt,
    promoClaimCost,
    XPtoLEVEL,
    formatDateTimeRelative,
} = require('../utils/tools')

const {
    formatName,
    withCards,
    withGlobalCards,
    filter,
    mapUserCards,
} = require('../modules/card')

const {
    fetchOnly,
    getDailyQuest,
    getUserCards,
    getUserQuests,
    getWeeklyQuest,
    getMonthlyQuest,
    deleteDailyQuests,
} = require('../modules/user')

const {
    addGuildXP,
    rankXP,
    getBuilding,
} = require('../modules/guild')

const {
    withUserItems,
    useItem,
    getQuestion,
    itemInfo,
    checkItem,
} = require('../modules/item')

const {
    getPending,
} = require('../modules/transaction')

const {
    fetchTaggedCards,
} = require('../modules/tag')

const { 
    get_hero,
}   = require('../modules/hero')

const {
    check_effect,
} = require('../modules/effect')

const {
    getQueueTime,
    getVialCostFast,
    evalCardFast,
} = require('../modules/eval')

const {
    getLastAnnouncement,
} = require('../modules/preferences')

const {
    plotPayout,
    getUserPlots,
} = require("../modules/plot");

const {
    withInteraction,
} = require("../modules/interactions")

const {
    getStats,
    getStaticStats,
    getAllStats,
    saveAndCheck,
    formatUserStats,
    getTimedStats,
} = require("../modules/userstats")



cmd('balance', withInteraction( async (ctx, user) => {
    let max = 1
    let stats = await getStats(ctx, user, user.lastdaily)
    const now = new Date()
    const promo = ctx.promos.find(x => x.starts < now && x.expires > now)
    if(ctx.guild) {
        while(claimCost(user, ctx.guild.tax, max, stats.claims) < user.exp)
            max++
    } else {
        while(claimCost(user, 0, max, stats.claims) < user.exp)
            max++
    }

    const embed = {
        color: colors.green,
        description: `you have **${numFmt(Math.round(user.exp))}** ${ctx.symbols.tomato}, **${numFmt(Math.round(user.vials))}** ${ctx.symbols.vial} and **${numFmt(Math.round(user.lemons))}** ${ctx.symbols.lemon}
            Your next claim will cost **${numFmt(claimCost(user, 0, 1, stats.claims))}** ${ctx.symbols.tomato}
            ${ctx.guild? `Next claim in current guild: **${numFmt(claimCost(user, ctx.guild.tax, 1, stats.claims))}** ${ctx.symbols.tomato} (+${ctx.guild.tax * 100}% claim tax)`:''}
            You can claim **${numFmt(max - 1)} cards** ${ctx.guild? `in current guild `:''}with your balance`
    }

    if(promo) {
        max = 1
        while(promoClaimCost(user, max, stats.promoclaims) < user.promoexp)
            max++

        embed.fields = [{
            name: `Promo balance`,
            value: `You have **${numFmt(Math.round(user.promoexp))}** ${promo.currency}
                Your next claim will cost **${numFmt(promoClaimCost(user, 1, stats.promoclaims))}** ${promo.currency}
                You can claim **${numFmt(max - 1)} ${promo.name} cards** with your balance`
        }]
    }

    return ctx.reply(user, embed)
})).access('dm')

cmd(['inventory', 'list'], withInteraction(withUserItems((ctx, user, items, args) => {
    return ctx.sendPgn(ctx, user, {
        pages: ctx.pgn.getPages(items.map((x, i) => `${i+1}. \`${x.id}\` **${x.name}** (${x.type.replace(/_/, ' ')})`), 5),
        switchPage: (data) => data.embed.fields[1].value = data.pages[data.pagenum],
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, your inventory` },
            fields: [
                { name: `Usage`, value: `To view the item details use \`${ctx.prefix}inventory info\`
                    To use the item \`${ctx.prefix}inventory use\`` },
                { name: `List (${items.length} results)`, value: '' }
            ],
            color: colors.blue,
        }
    })
})))

cmd(['inventory', 'use'], withInteraction(withUserItems(async (ctx, user, items, args, index) => {
    const item = items[0]
    const itemCheck = await checkItem(ctx, user, item, args)

    if(itemCheck)
        return ctx.reply(user, itemCheck, 'red')

    return ctx.sendCfm(ctx, user, {
        force: ctx.globals.force,
        question: getQuestion(ctx, user, item),
        onConfirm: (x, y) => {
            ctx.extraInteraction = y
            useItem(ctx, user, item, index, args)
        }
    }, false)
})))

cmd(['inventory', 'info'], withInteraction(withUserItems(async (ctx, user, items, args) => {
    const item = items[0]

    const embed = await itemInfo(ctx, user, item)
    embed.color = colors.blue
    embed.author = { name: `${item.name} (${item.type.replace(/_/, ' ')})` }

    if(item.col)
        embed.description += `\nThis ticket is for collection \`${item.col}\``

    return ctx.send(ctx.interaction, embed)
})))

cmd('daily', withInteraction(async (ctx, user) => {

    user.lastdaily = user.lastdaily || new Date(0)
    const oldStats = await getStaticStats(ctx, user, user.lastdaily)
    const oldClaims = oldStats.claims || 0

    const now = new Date()
    const hasJeanne = await check_effect(ctx, user, 'rulerjeanne')
    const future = asdate.add(user.lastdaily, hasJeanne? 17 : 20, 'hours')
    const streakCheck = oldStats.daily >= asdate.subtract(new Date(), 2, 'days')
    const hasBuilding = await getBuilding(ctx, ctx.guild.id, 'processingplant')
    const baseAmount = 500
    if(future < now) {
        const quests = []
        let amount, streakAdd, buildingAdd
        const promoAmount = 500 + ((oldStats.promoclaims * 50) || 0)
        const promo = ctx.promos.find(x => x.starts < now && x.expires > now)
        const boosts = ctx.boosts.filter(x => x.starts < now && x.expires > now)
        const hero = await get_hero(ctx, user.hero)
        const userLevel = XPtoLEVEL(user.xp)
        await deleteDailyQuests(ctx, user)
        const userquests = await getUserQuests(ctx, user)
        const weeklies = userquests.filter(x => x.type === 'weekly')
        const monthlies = userquests.filter(x => x.type === 'monthly')
        let stats = await getStats(ctx, user)
        stats.daily = now
        amount = baseAmount

        if(hasBuilding)
            amount += (hasBuilding.level * 0.05) * baseAmount

        if(streakCheck) {
            user.streaks.daily++
            streakAdd = user.streaks.daily >= 100? amount: Math.ceil(baseAmount * (user.streaks.daily / 100))
            amount += streakAdd
        } else {
            user.streaks.daily = 0
        }

        if(await check_effect(ctx, user, 'cakeday')) {
            amount += 100 * oldClaims
        }

        if (promo) {
            user.promoexp += promoAmount
            stats.promoin += promoAmount
        }

        user.lastdaily = now
        user.exp += amount
        user.xp += 10
        stats.tomatoin += amount


        quests.push({type: 'daily', quest: getDailyQuest(ctx, user, 1), hours: 20, created: now})
        quests.push({type: 'daily', quest: getDailyQuest(ctx, user, userLevel > 10? 2 : 1, quests[0].quest.id.slice(0,-1)), hours: 20, created: now})

        if (weeklies.length === 0 || weeklies[0].expiry < now) {
            quests.push({type: 'weekly', quest: getWeeklyQuest(ctx, user, 3), hours: 168, created: now})
            quests.push({type: 'weekly', quest: getWeeklyQuest(ctx, user, userLevel > 10? 4 : 3, quests.filter(x => x.type === 'weekly')[0].quest.id), hours: 168, created: now})
        }

        if (monthlies.length === 0 || monthlies[0].expiry < now) {
            quests.push({type: 'monthly', quest: getMonthlyQuest(ctx, user, 5), hours: 720, created: now})
            quests.push({type: 'monthly', quest: getMonthlyQuest(ctx, user, userLevel > 10? 6 : 5, quests.filter(x => x.type === 'monthly')[0].quest.id), hours: 720, created: now})
        }

        await addGuildXP(ctx, user, 10)
        ctx.guild.balance += userLevel
        try {
            await ctx.guild.save()
        } catch (e) {
            process.send({error: {message: e.message, stack: e.stack}})
            console.log(user.discord_id)
            console.log(ctx.guild)
        }
        if(hero) {
            hero.xp += 3
            await hero.save()
        }

        const fields = []
        let questUpdate = []
        if(quests.length > 0) {
            fields.push({
                name: `Daily quest(s)`, 
                value: quests.filter(q => q.type === 'daily').map((x, i) => `${i + 1}. ${x.quest.name} (${x.quest.reward(ctx)})`).join('\n')
            })
            if (quests.some(x => x.type === 'weekly'))
                fields.push({
                    name: `New Weekly quest(s)`,
                    value: quests.filter(q => q.type === 'weekly').map((x, i) => `${i + 1}. ${x.quest.name} (${x.quest.reward(ctx)})`).join('\n')
                })
            if (quests.some(x => x.type === 'monthly'))
                fields.push({
                    name: `New Monthly quest(s)`,
                    value: quests.filter(q => q.type === 'monthly').map((x, i) => `${i + 1}. ${x.quest.name} (${x.quest.reward(ctx)})`).join('\n')
                })
            quests.map(q => questUpdate.push({insertOne: {document: {userid: user.discord_id, questid: q.quest.id, type: q.type, expiry: asdate.add(new Date(), q.hours, 'hours'), created: q.created}}}))
        }

        const trs = (await getPending(ctx, user)).filter(x => x.from_id != user.discord_id)
        if(trs.length > 0) {
            const more = trs.splice(3, trs.length).length
            fields.push({name: `Incoming pending transactions`, 
                value: trs.map(x => `\`${x.id}\` ${x.cards.length} card(s) from **${x.from}**`).join('\n')
                    + (more > 0? `\nand **${more}** more...` : '')
            })
        }

        if(promo || boosts.length > 0) {
            fields.push({name: `Current events and boosts`,
                value: `${promo? `[${msToTime(promo.expires - now, {compact: true})}] **${promo.name}** event (\`${ctx.prefix}claim cards promo:true\`)` : ''}
                ${boosts.map(x => 
                `[${msToTime(x.expires - now, {compact: true})}] **${x.rate * 100}%** drop rate for **${x.name}** when you run \`${ctx.prefix}claim cards boost_id:${x.id}\``).join('\n')}`
            })
        }

        const announce = await getLastAnnouncement(ctx, user)
        if(announce) {
            if (announce.body.length > 512) {
                announce.body = announce.body.substr(0, 512)
                announce.body += `...\n**This announcement has been trimmed to keep this daily message short. To see the full announcement message use \`${ctx.prefix}announcement\`**`
            }

            fields.push({
                name: announce.title,
                value: announce.body,
            })

            user.lastannounce = announce.date
        }

        fields.push({
            name: `Learn what you still need to do`,
            value: `Use \`${ctx.prefix}todo\` to view a TODO list for the bot.
                This will help you to figure out what else left to claim or complete today.`,
        })

        user.dailynotified = false
        await user.save()
        await UserQuest.bulkWrite(questUpdate)
        await saveAndCheck(ctx, user, stats)
        await plotPayout(ctx, 'gbank', 1, 5)

        ctx.mixpanel.track(
            "Daily", { 
                distinct_id: user.discord_id,
                guild_id: ctx.guild.id,
                amount,
                promo_amount: promoAmount,
        })

        let desc = `you received daily **${numFmt(amount)}** ${ctx.symbols.tomato} ${promo? `and **${numFmt(promoAmount)}** ${promo.currency}`: ""}\n`

        if(streakCheck)
            desc += `You are currently on a **${numFmt(user.streaks.daily)}** day daily streak! You gained an additional **${numFmt(streakAdd)}** ${ctx.symbols.tomato}\n`

        desc += `You now have **${numFmt(Math.round(user.exp))}** ${ctx.symbols.tomato} ${promo? `and **${numFmt(user.promoexp)}** ${promo.currency}`: ""}`

        return ctx.reply(user, {
            description: desc,
            color: colors.green,
            fields
        })
    }

    return ctx.reply(user, `you can claim your daily **${formatDateTimeRelative(future)}**
                If you want to be notified when your daily is ready use: 
                \`${ctx.prefix}preferences set notify daily\``, 'red')
}))

cmd('cards', withInteraction( withCards(async (ctx, user, cards, parsedargs) => {
    const now = new Date()
    const cardstr = cards.map(c => {
        const isnew = c.obtained > (user.lastdaily || now)
        return (isnew? '**[new]** ' : '') + formatName(c) + (c.amount > 1? ` (x${numFmt(c.amount)}) ` : ' ') + (c.rating? `[${c.rating}/10] ` : '') + (parsedargs.evalQuery? `${evalCardFast(ctx, c)}${ctx.symbols.tomato}`: '')
    })

    const evalTime = getQueueTime()
    if(evalTime > 0 && parsedargs.evalQuery) {
        return ctx.reply(user, {
            description: `some of your cards are still processing their evals.
                Please check in **${msToTime(evalTime)}** for results.`
        }, 'yellow')
    }

    return ctx.sendPgn(ctx, user, {
        pages: ctx.pgn.getPages(cardstr, 15),
        embed: { author: { name: `${user.username}, your cards (${numFmt(cards.length)} results)` } }
    })
}))).access('dm')

cmd('profile', withInteraction(async (ctx, user, args) => {
    if(args.ids.length > 0) user = await fetchOnly(args.ids[0]).lean()

    if(!user)
        return ctx.send(ctx.interaction, {
            description: `Cannot find user with ID ${args.ids[0]}`,
            color: colors.red
        })

    const completedSum = user.completedcols.length
    const cloutsum = user.cloutedcols.map(x => x.amount).reduce((a, b) => a + b, 0)
    const highestClout = user.cloutedcols.sort((a, b) => b.amount - a.amount)[0]
    const stamp = user.joined || user._id.getTimestamp()
    const userCards = await getUserCards(ctx, user)
    const cards = mapUserCards(ctx, userCards)
    const joinTime = Math.floor(stamp / 1000)
    let price = 0
    let vials = 0
    let description
    cards.map(card => {
        const eval = evalCardFast(ctx, card)
        if(eval >= 0) {
            price += Math.round(eval) * card.amount
        } else {
            price = NaN
        }
        if(card.level < 4 && eval > 0) {
            vials += getVialCostFast(ctx, card, eval) * card.amount
        }
    })
    const fields = []
    fields.push({
        name: "General Stats",
        value: `Level: **${XPtoLEVEL(user.xp)}**\nJoined: **<t:${joinTime}:R>**\n`,
        inline: true
    })
    if(user.roles && user.roles.length > 0)
        fields[0].value += `Roles: **${user.roles.join(" **|** ")}**`
    fields.push({
        name: "Card Stats",
        value: `Cards: **${numFmt(userCards.length)}** | Stars: **${numFmt(cards.map(x => x.level).reduce((a, b) => a + b, 0))}**\n`,
        inline: true
    })
    if (args.ids.length > 0 && !isNaN(price)) {
        fields[1].value += `Cards Worth: **${numFmt(price)}** ${ctx.symbols.tomato} or **${numFmt(vials)} ${ctx.symbols.vial}**`
    } else if (!isNaN(price)) {
        fields[1].value += `Net Worth: **${numFmt(price + user.exp)}** ${ctx.symbols.tomato} or **${numFmt(vials + user.vials)} ${ctx.symbols.vial}**`
    } else {
        const evalTime = getQueueTime()
        fields[1].value += `Worth: **Calculating , try again in ${msToTime(evalTime)}**`
    }

    fields.push({
        name: "",
        value: "",
        inline: true
    })

    if(completedSum > 0) {
        const completedField = {
            name: "Collection Stats",
            value: `Completed collections: **${numFmt(user.completedcols.length)}**\n`,
            inline: true
        }
        if (user.prefs.profile.favcomplete && user.premium)
            completedField.value += `Favorite Completion: **${user.prefs.profile.favcomplete}**`
        fields.push(completedField)

    }
    if(cloutsum > 0) {
        const cloutField = {
            name: "Clout Stats",
            value: `Overall clout: **${numFmt(cloutsum)}**\nHighest Clout Count: **${highestClout.amount}** \`${highestClout.id}\`\n`,
            inline: true
        }
        if (user.prefs.profile.favclout && user.premium)
            cloutField.value += `Favorite clouted col: **${user.cloutedcols.find(x => x.id === user.prefs.profile.favclout).amount}** \`${user.prefs.profile.favclout}\``
        fields.push(cloutField)
    }

    const remaining = 6 - fields.length
    for (let i = 0; i < remaining; i++) {
        fields.push({
            name: "",
            value: "",
            inline: true
        })
    }

    if (user.prefs.profile.bio != 'This user has not set a bio')
        description = `Bio: **${user.prefs.profile.bio}**`

    // if(ctx.guild) {
    //     const curUser = ctx.guild.userstats.find(x => x.id === user.discord_id)
    //     if(curUser){
    //         resp.push(`Current guild rank: **${curUser.rank}** (${curUser.rank == 5? 'Max': Math.round((curUser.xp / rankXP[curUser.rank]) * 100) + '%'})`)
    //     }
    // }

    const title = ctx.achievements.find(x => x.id === user.prefs.profile.title)?.title.replace('{name}', user.username) || ''

    const botuser = ctx.bot.users.find(x => x.id === user.discord_id)
    return ctx.send(ctx.interaction, {
        title,
        description,
        fields,
        color: user.prefs.profile.color && user.premium? user.prefs.profile.color: '16756480',
        image: {
            url: user.prefs.profile.card && user.premium? ctx.cards[user.prefs.profile.card].url: ''
        },
        thumbnail: {
            url: botuser? botuser.avatarURL('png'): ''
        },
        author: {
            name: `${user.username} (${user.discord_id})`
        }
    }, user.discord_id)
})).access('dm')

cmd(['diff', 'from'], withInteraction(async (ctx, user, args) => {
    if(!args.ids[0])
        return ctx.qhelp(ctx, user, 'diff')

    const otherUser = await fetchOnly(args.ids[0])
    if(!otherUser)
        return ctx.reply(user, `could not find target user`, 'red')

    const otherUserCards = await getUserCards(ctx, otherUser)
    let otherCards = filter(mapUserCards(ctx, otherUserCards), args).filter(x => !x.locked)

    if(!otherUser.prefs.interactions.candiff)
        return ctx.reply(user, `the user you are checking has disabled the ability to use \`/diff\` commands on them`, 'red')

    if(otherCards.length === 0)
        return ctx.reply(user, `**${otherUser.username}** doesn't have any cards matching this request`, 'red')

    if(args.tags.length > 0) {
        const tgcards = await fetchTaggedCards(args.tags)
        otherCards = otherCards.filter(x => tgcards.includes(x.id))
    }

    if(args.antitags.length > 0) {
        const tgcards = await fetchTaggedCards(args.antitags)
        otherCards = otherCards.filter(x => !tgcards.includes(x.id))
    }

    const selfCards = await getUserCards(ctx, user)
    const ids = selfCards.map(x => x.cardid)
    const diff = otherCards.filter(x => ids.indexOf(x.cardid) === -1)
        .filter(x => x.fav && x.amount == 1 && !args.fav? x.cardid === -1 : x)
        .sort(args.sort)

    if(diff.length === 0)
        return ctx.reply(user, `no different cards found`, 'red')

    return ctx.sendPgn(ctx, user, {
        pages: ctx.pgn.getPages(diff.map(x => `${formatName(x)} ${x.amount > 1? `(x${x.amount})`: ''} ${x.rating? `[${x.rating}/10]` : ''}`), 15),
        embed: { author: { name: `${user.username}, unique cards FROM ${otherUser.username} (${numFmt(diff.length)} results)` } }
    })
}))

cmd(['diff', 'for'], withInteraction(async (ctx, user, args) => {
    if(!args.ids[0])
        return ctx.qhelp(ctx, user, 'diff')

    const otherUser = await fetchOnly(args.ids[0])
    if(!otherUser)
        return ctx.reply(user, 'cannot find user with that ID', 'red')

    if(!otherUser.prefs.interactions.candiff)
        return ctx.reply(user, `the user you are checking has disabled the ability to use \`/diff\` commands on them`, 'red')

    const otherCards = await getUserCards(ctx, otherUser)
    const userCards = await getUserCards(ctx, user)
    let mappedCards = filter(mapUserCards(ctx, userCards), args)

    if(otherCards.length === 0)
        return ctx.reply(user, `**${otherUser.username}** doesn't have any cards matching this request`, 'red')

    if(args.tags.length > 0) {
        const tgcards = await fetchTaggedCards(args.tags)
        mappedCards = mappedCards.filter(x => tgcards.includes(x.id))
    }

    if(args.antitags.length > 0) {
        const tgcards = await fetchTaggedCards(args.antitags)
        mappedCards = mappedCards.filter(x => !tgcards.includes(x.id))
    }

    if (!args.locked)
        mappedCards = mappedCards.filter(x => !x.locked)

    const ids = otherCards.map(x => x.cardid)
    const diff = mappedCards.filter(x => ids.indexOf(x.cardid) === -1)
        .filter(x => x.fav && x.amount == 1 && !args.fav? x.cardid === -1 : x)
        .sort(args.sort)

    if(diff.length === 0)
        return ctx.reply(user, `no different cards found`, 'red')

    return ctx.sendPgn(ctx, user, {
        pages: ctx.pgn.getPages(diff.map(x => `${formatName(x)} ${x.amount > 1? `(x${x.amount})`: ''} ${x.rating? `[${x.rating}/10]` : ''}`), 15),
        embed: { author: { name: `${user.username}, unique cards FOR ${otherUser.username} (${numFmt(diff.length)} results)` } }
    })
}))

cmd('has', withInteraction(async (ctx, user, args) => {
    if(!args.ids[0])
        return ctx.qhelp(ctx, user, 'has')

    if(user.discord_id == args.ids[0])
        return ctx.reply(user, `you can use ${ctx.prefix}cards to see your own cards`, 'red')

    const otherUser = await fetchOnly(args.ids[0])
    if(!otherUser)
        return ctx.reply(user, 'cannot find user with that ID', 'red')

    if(!otherUser.prefs.interactions.canhas)
        return ctx.reply(user, `the user you are attempting to check has disabled the ability to check their cards with \`/has\``, 'red')

    const otherCards = await getUserCards(ctx, otherUser)
    const otherFilteredCards = filter(mapUserCards(ctx, otherCards), args).filter(x => !x.locked)

    if (otherFilteredCards.length === 0)
        return ctx.reply(user, `**${otherUser.username}** doesn't have that card.`, 'red')

    if (args.filters.length === 0 || otherFilteredCards.map(x=> `${formatName(x)}`).length > 1) {
        return ctx.reply(user, 'Please specify a single card to match', 'red')
    }
    return ctx.reply(user, `Matched card ${otherFilteredCards.map(x => `${formatName(x)} ${x.fav? 'and it is marked as **favorite**': ''}`)}`)
}))

cmd('miss', withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const userCards = await getUserCards(ctx, user)
    const ids = userCards.map(x => x.cardid)
    const diff = cards.filter(x => ids.indexOf(x.id) === -1)
        .filter(x => !x.excluded)
        .sort(parsedargs.sort)

    if(diff.length === 0)
        return ctx.reply(user, `you have all cards matching this request!`)

    return ctx.sendPgn(ctx, user, {
        pages: ctx.pgn.getPages(diff.map(x => formatName(x)), 15),
        embed: { author: { name: `${user.username}, cards that you don't have (${numFmt(diff.length)} results)` } }
    })
})))

cmd(['quest', 'list'], withInteraction(async (ctx, user) => {
    let quests = await getUserQuests(ctx, user)
    quests = quests.filter(x => !x.completed)

    if (quests.length === 0)
        return ctx.reply(user, `you don't have any quests.
        You get new quests each time you claim your \`${ctx.prefix}daily\` bonus.
        For more information see \`${ctx.prefix}help help_menu:quests\``, 'red')


    const combinedStats = {
        weekly: [],
        monthly: []
    }
    const dayStats = await getStaticStats(ctx, user, user.lastdaily)
    const allStats = await getAllStats(ctx, user)
    const statKeys = Object.keys(dayStats)
    _.pull(statKeys, '_id', 'daily', 'discord_id', 'username', '__v')

    const weekly = quests.find(x => x.type === 'weekly' && !x.completed)?.created
    const monthly = quests.find(x => x.type === 'monthly' && !x.completed)?.created
    allStats.map(x => {
        if (x.daily >= asdate.subtract(dayStats.daily, 7, 'days') && x.daily >= weekly)
            statKeys.map(y => {
                if (!Number.isNaN(x[y]))
                    combinedStats.weekly[y]? combinedStats.weekly[y] += x[y]: combinedStats.weekly[y] = x[y]
            })
        if (x.daily >= asdate.subtract(dayStats.daily, 30, 'days') && x.daily >= monthly)
            statKeys.map(y => {
                if (!Number.isNaN(x[y]))
                    combinedStats.monthly[y]? combinedStats.monthly[y] += x[y]: combinedStats.monthly[y] = x[y]
            })
    })
    let dailyQuests = quests.filter(x => x.type === 'daily').map((y, i) => {
        const info = ctx.quests.daily.find(z => z.id === y.questid)
        return `${i + 1}. \`${new Array(info.tier + 1).join('★')}\` ${info.name} (${info.reward(ctx)})
        Expires: ${formatDateTimeRelative(y.expiry)}`
    })

    let weeklyQuests = quests.filter(x => x.type === 'weekly').map((y, i) => {
        const info = ctx.quests.weekly.find(z => z.id === y.questid)
        return `${i + 1}. \`${new Array(info.tier + 1).join('★')}\` ${info.name} (${info.reward(ctx)})
        Expires: ${formatDateTimeRelative(y.expiry)} | Progress: ${info.progress(ctx, user, dayStats, combinedStats.weekly)}`
    })

    let monthlyQuests = quests.filter(x => x.type === 'monthly').map((y, i) => {
        const info = ctx.quests.monthly.find(z => z.id === y.questid)
        return `${i + 1}. \`${new Array(info.tier + 1).join('★')}\` ${info.name} (${info.reward(ctx)})
        Expires: ${formatDateTimeRelative(y.expiry)} | Progress: ${info.progress(ctx, user, dayStats, combinedStats.monthly)}`
    })

    const pages = []

    if (dailyQuests.length !== 0)
        pages.push({
            name: `${user.username}, your DAILY quests:`,
            info: dailyQuests.join('\n')
        })

    if (weeklyQuests.length !== 0)
        pages.push({
            name: `${user.username}, your WEEKLY quests:`,
            info: weeklyQuests.join('\n')
        })

    if (monthlyQuests.length !== 0)
        pages.push({
            name: `${user.username}, your MONTHLY quests:`,
            info: monthlyQuests.join('\n')
        })

    if (pages.length === 0)
        return ctx.reply(user, `you have completed all of your quests! You can get some more with your next \`daily\`!`)

    return ctx.sendPgn(ctx, user, {
        pages,
        buttons: ['back', 'forward'],
        switchPage: (data) => {
            const page = data.pages[data.pagenum]
            data.embed.author.name = page.name
            data.embed.description = page.info
            data.embed.footer = {text: `${data.pagenum + 1}/${data.pages.length} | To get help with a quest use '/quest info'`}
        },
        embed: {
            author: { name: '' },
            description: 'loading',
            color: colors.blue
        }
    })
}))

cmd(['quest', 'info'], withInteraction(async (ctx, user) => {
    let quests = (await getUserQuests(ctx, user)).filter(x => !x.completed)

    if(quests.length === 0)
        return ctx.reply(user, `you don't have any quests`, 'red')

    let pages = []

    quests.map(x => {
        const quest = ctx.quests[x.type].find(y => x.questid === y.id)
        let embed = {
            color: colors.blue,
            name: quest.name,
            fields: [
                { name: 'Guide', value: quest.desc.replace(/->/gi, ctx.prefix) },
                { name: 'Related help', value: `This quest is completed using the **${quest.actions[0]}** command. 
                For more information type: \`${ctx.prefix}help help_menu:${quest.actions[0]}\`` },
            ]
        }
        const resp = []
        resp.push(`Tier: \`${new Array(quest.tier + 1).join('★')}\``)
        resp.push(`Required user level: **${quest.min_level}**`)
        resp.push(`Reward: ${quest.reward(ctx)}`)
        resp.push(`Expires: ${formatDateTimeRelative(x.expiry)}`)
        embed.description = resp.join('\n')
        pages.push(embed)
    })


    return ctx.sendPgn(ctx, user, {
        pages,
        buttons: ['back', 'forward'],
        switchPage: (data) => {
            const page = data.pages[data.pagenum]
            data.embed.author.name = page.name
            data.embed.description = page.description
            data.embed.fields = page.fields
        },
        embed: {
            author: { name: '' },
            description: 'loading',
            color: colors.blue
        }
    })
}))

cmd('stats', withInteraction(async (ctx, user) => {
    const quests = await getUserQuests(ctx, user)
    const stats = {
        daily: {},
        weekly: {},
        monthly: {},
        allTime: {}
    }
    const weeklyQuest = quests.find(x => x.type === 'weekly')
    const monthlyQuest = quests.find(x => x.type === 'monthly')
    const dailyStats = await getStaticStats(ctx, user, user.lastdaily)
    const weeklyStats = await getTimedStats(ctx, user, weeklyQuest != undefined? weeklyQuest.created: asdate.subtract(user.lastdaily, 7, 'days'))
    const monthlyStats = await getTimedStats(ctx, user, monthlyQuest != undefined? monthlyQuest.created: asdate.subtract(user.lastdaily, 30, 'days'))
    const allTimeStats = (await getAllStats(ctx, user))
    const keys = _.keys(dailyStats)
    _.pull(keys, '_id', 'daily', 'discord_id', 'username', '__v')
    keys.map(x => {
        const weekCount = weeklyStats.map(y => y[x]).reduce((a, b) => a + b, 0)
        const monthCount = monthlyStats.map(y => y[x]).reduce((a, b) => a + b, 0)
        const allCount = allTimeStats.map(y => y[x]).reduce((a, b) => a + b, 0)
        if (dailyStats[x] > 0)
            stats.daily[x] = dailyStats[x]
        if (weekCount > 0)
            stats.weekly[x] = weekCount
        if (monthCount > 0)
            stats.monthly[x] = monthCount
        if (allCount > 0)
            stats.allTime[x] = allCount
    })
    stats.allTime['totaldaily'] = allTimeStats.length

    let pages = []
    let types = ['daily', 'weekly', 'monthly', 'allTime']
    for (let i = 0; i < 4; i++) {
        const type = types[i]
        if (_.isEmpty(stats[type]))
            continue
        let table = new AsciiTable(`Your ${type} stats!`)
        if (type == 'allTime') {
            const allDaily = formatUserStats('totaldaily', stats[type]['totaldaily'])
            table.addRow(allDaily.stat, numFmt(allDaily.count))
        }
        keys.map(x => {
            if (!stats[type][x])
                return
            const format = formatUserStats(x, stats[type][x])
            table.addRow(format.stat, numFmt(format.count))
        })
        pages.push(`\`\`\`${table.toString()}\`\`\``)
    }

    return ctx.sendPgn(ctx, user, {
        pages,
        buttons: ['back', 'forward'],
        embed: {
            color: colors.blue
        }
    })
}))

cmd('achievements', withInteraction(async (ctx, user, args) => {
    let list = user.achievements.map(x => {
        const item = ctx.achievements.find(y => y.id === x)
        return `${item.title? `\`🏆\` `: ''}**${item.name}** • \`${item.desc}\`${item.hidden? ` • *Hidden*`: ''}`
    })

    const miss = args.missing
    let missDiff

    if (miss) {
        list = ctx.achievements.filter(x => !user.achievements.some(y => x.id === y) && !x.hidden).map(z => `**${z.name}** • \`${z.desc}\``)
        missDiff = ctx.achievements.filter(x => !user.achievements.some(y => x.id === y) && x.hidden).length
    }

    const embed = {author: { name: `${user.username}, ${miss? 'missing' : 'completed'} achievements: (${list.length}${miss? ` + ${missDiff} Hidden`: ''})` }}

    if (!miss)
        embed.footer = {text: `🏆 grants a title. To see achievements you don't have, use missing:true`}

    if (list.length === 0 && miss)
        return ctx.reply(user, `there is nothing to display here! You are missing **${missDiff}** hidden achievements!`, 'red')

    if (list.length === 0)
        return ctx.reply(user, `there is nothing to display here!`, 'red')

    return ctx.sendPgn(ctx, user, {
        pages: ctx.pgn.getPages(list, 15),
        embed
    })
}))

cmd('vote', withInteraction(async (ctx, user) => {
    const now = new Date()
    const future = asdate.add(user.lastvote, 12, 'hours')
    const topggTime = msToTime(future - now, { compact: true })

    return ctx.send(ctx.interaction, {
        color: colors.blue,
        description: `You can vote for Amusement Club **every 12 hours** and get rewards.
        Make sure you have allowed messages from server members in order to receive rewards in DMs.
        - [Vote on top.gg](${ctx.links.topggUrl}) to get **free cards** (${future > now? topggTime : `ready`})
        - [Vote on Discord Bot List](${ctx.links.dblUrl}) to get **free ${ctx.symbols.tomato}**`,
        
        fields: [
            {
                name: `Get notified`,
                value: `You can enable bot notifications to let you know that it is time to vote. 
                Simply run \`${ctx.prefix}preferences set notify vote\``
            }
        ]
    }, user.discord_id)
})).access('dm')

cmd('todo', withInteraction(async (ctx, user) => {
    const resp = []
    const plots = await getUserPlots(ctx, true)
    const stats = await getStaticStats(ctx, user, user.lastdaily)
    const quests = (await getUserQuests(ctx, user)).find(x => x.type === 'daily' && !x.completed)
    const now = new Date()
    const futureDaily = asdate.add(user.lastdaily, await check_effect(ctx, user, 'rulerjeanne')? 17 : 20, 'hours')
    const futureVote = asdate.add(user.lastvote, 12, 'hours')
    const daily = futureDaily < now
    const vote = futureVote < now
    const claim = stats.claims === 0
    const quest = !!quests
    const plot = plots.some(x=> x.building.stored_lemons > 0)
    
    resp.push(`${ctx.symbols.auc_sod} = done | ${ctx.symbols.auc_sbd} = not done`)
    resp.push(`${daily? ctx.symbols.auc_sbd : ctx.symbols.auc_sod} **Claim daily** [\`${ctx.prefix}daily\`] (this will reset your claim price)`)
    resp.push(`${vote? ctx.symbols.auc_sbd : ctx.symbols.auc_sod} **Vote for the bot** [\`${ctx.prefix}vote\`] (get rewards like cards and \`${ctx.symbols.tomato}\`)`)
    resp.push(`${claim? ctx.symbols.auc_sbd : ctx.symbols.auc_sod} **Claim a card** [\`${ctx.prefix}claim cards\`] (recommended to claim 4-6 cards per day)`)
    resp.push(`${quest? ctx.symbols.auc_sbd : ctx.symbols.auc_sod} **Complete quests** [\`${ctx.prefix}quests\`] (quests refresh daily)`)
    resp.push(`${plot? ctx.symbols.auc_sbd : ctx.symbols.auc_sod} **Collect plot income** [\`${ctx.prefix}plots\`] (you must have built at least one plot)`)
    resp.push(`Use \`${ctx.prefix}stats\` to see what you did today`)

    return ctx.send(ctx.interaction, {
        color: colors.blue,
        author: { name: `${user.username}, your TODO list:` },
        description: resp.join('\n'),
    })
}))
