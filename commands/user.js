const msToTime          = require('pretty-ms')
const {cmd}             = require('../utils/cmd')
const colors            = require('../utils/colors')
const asdate            = require('add-subtract-date')
const _                 = require('lodash')
const AsciiTable        = require("ascii-table")

const {
    cap,
    claimCost,
    numFmt,
    promoClaimCost,
    XPtoLEVEL,
} = require('../utils/tools')

const {
    formatName,
    withCards,
    withGlobalCards,
    parseArgs,
    filter,
    mapUserCards,
} = require('../modules/card')

const {
    fetchOnly,
    getQuest,
    getUserCards,
} = require('../modules/user')

const {
    addGuildXP,
    getBuilding,
    rankXP,
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
    saveAndCheck,
    formatUserStats,
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
        onConfirm: (x) => useItem(ctx, user, item, index, args)
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

    if(future < now) {
        const quests = []
        let amount = 750
        const promoAmount = 500 + ((oldStats.promoclaims * 50) || 0)
        const promo = ctx.promos.find(x => x.starts < now && x.expires > now)
        const boosts = ctx.boosts.filter(x => x.starts < now && x.expires > now)
        const hero = await get_hero(ctx, user.hero)
        const userLevel = XPtoLEVEL(user.xp)
        let stats = await getStats(ctx, user)
        stats.daily = now
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
        user.dailyquests = []
        stats.tomatoin += amount


        quests.push(getQuest(ctx, user, 1))
        user.dailyquests.push(quests[0].id)

        quests.push(getQuest(ctx, user, userLevel > 10? 2 : 1, quests[0].id.slice(0,-1)))
        user.dailyquests.push(quests[1].id)

        user.markModified('dailyquests')

        await addGuildXP(ctx, user, 10)
        ctx.guild.balance += userLevel
        await ctx.guild.save()

        if(hero) {
            hero.xp += 3
            await hero.save()
        }

        const fields = []
        if(quests.length > 0) {
            fields.push({
                name: `Daily quest(s)`, 
                value: quests.map((x, i) => `${i + 1}. ${x.name} (${x.reward(ctx)})`).join('\n')
            })
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
        await saveAndCheck(ctx, user, stats)
        await plotPayout(ctx, 'gbank', 1, 5)

        ctx.mixpanel.track(
            "Daily", { 
                distinct_id: user.discord_id,
                guild_id: ctx.guild.id,
                amount,
                promo_amount: promoAmount,
        })

        return ctx.reply(user, {
            description: `you received daily **${numFmt(amount)}** ${ctx.symbols.tomato} ${promo? `and **${numFmt(promoAmount)}** ${promo.currency}`: ""}
                You now have **${numFmt(Math.round(user.exp))}** ${ctx.symbols.tomato} ${promo? `and **${numFmt(user.promoexp)}** ${promo.currency}`: ""}`,
            color: colors.green,
            fields
        })
    }

    return ctx.reply(user, `you can claim your daily in **${msToTime(future - now)}**
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

cmd('favs', withInteraction( withCards(async (ctx, user, cards, parsedargs) => {
    const now = new Date()
    cards = cards.filter(x => x.fav)
    if (cards.length === 0)
        return ctx.reply(user, 'you have no cards favorited!', 'red')
    const cardstr = cards.map(c => {
        const isnew = c.obtained > (user.lastdaily || now)
        return (isnew? '**[new]** ' : '') + formatName(c) + (c.amount > 1? ` (x${numFmt(c.amount)}) ` : ' ') + (c.rating? `[${c.rating}/10]` : '')
    })

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
    const stamp = user.joined || user._id.getTimestamp()
    const userCards = await getUserCards(ctx, user)
    const cards = mapUserCards(ctx, userCards)
    const joinTime = Math.floor(stamp / 1000)
    let price = 0
    let vials = 0
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
    const resp = []
    resp.push(`Level: **${XPtoLEVEL(user.xp)}**`)
    resp.push(`Cards: **${numFmt(userCards.length)}** | Stars: **${numFmt(cards.map(x => x.level).reduce((a, b) => a + b, 0))}**`)

    if (args.ids.length > 0 && !isNaN(price)) {
        resp.push(`Cards Worth: **${numFmt(price)}** ${ctx.symbols.tomato} or **${numFmt(vials)} ${ctx.symbols.vial}**`)
    } else if (!isNaN(price)) {
        resp.push(`Net Worth: **${numFmt(price + user.exp)}** ${ctx.symbols.tomato} or **${numFmt(vials + user.vials)} ${ctx.symbols.vial}**`)
    } else {
        const evalTime = getQueueTime()
        resp.push(`Worth: **Calculating , try again in ${msToTime(evalTime)}**`)
    }

    resp.push(`In game since: **<t:${joinTime}:D>** (<t:${joinTime}:R>)`)

    if(completedSum > 0) {
        resp.push(`Completed collections: **${numFmt(user.completedcols.length)}**`)
    }
    if(cloutsum > 0) {
        resp.push(`Overall clout: **${numFmt(cloutsum)}**`)
    }

    if(ctx.guild) {
        const curUser = ctx.guild.userstats.find(x => x.id === user.discord_id)
        if(curUser){
            resp.push(`Current guild rank: **${curUser.rank}** (${curUser.rank == 5? 'Max': Math.round((curUser.xp / rankXP[curUser.rank]) * 100) + '%'})`)
        }
    }

    if(user.roles && user.roles.length > 0)
        resp.push(`Roles: **${user.roles.join(" **|** ")}**`)

    const botuser = ctx.bot.users.find(x => x.id === user.discord_id)
    return ctx.send(ctx.interaction, {
        description: resp.join('\n'),
        color: colors['yellow'],
        author: {
            name: `${user.username} (${user.discord_id})`
        },
        thumbnail: {
            url: botuser? botuser.avatarURL : ''
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
    let otherCards = filter(mapUserCards(ctx, otherUserCards), args)

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

    const otherCards = await getUserCards(ctx, otherUser)
    const otherFilteredCards = filter(mapUserCards(ctx, otherCards), args)

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
    if(user.dailyquests.length === 0 && user.questlines.length === 0)
        return ctx.reply(user, `you don't have any quests.
        You get new quests each time you claim your \`${ctx.prefix}daily\` bonus.
        For more information see \`${ctx.prefix}help help_menu:quests\``, 'red')

    return ctx.send(ctx.interaction, {
        color: colors.blue,
        author: { name: `${user.username}, your quests:` },
        description: user.dailyquests.map((x, i) => {
            const qInfo = ctx.quests.daily.find(y => y.id === x)
            return `${i + 1}. \`${new Array(qInfo.tier + 1).join('★')}\` ${qInfo.name} (${qInfo.reward(ctx)})`
        }).join('\n') + `\nTo get help with the quest use \`${ctx.prefix}quest info\``
    }, user.discord_id)
}))

cmd(['quest', 'info'], withInteraction(async (ctx, user, args) => {
    const index = args.questNum - 1

    if(user.dailyquests.length === 0 && user.questlines.length === 0)
        return ctx.reply(user, `you don't have any quests`, 'red')

    if(!user.dailyquests[index])
        return ctx.reply(user, `cannot find quest with index **${index + 1}**.
            Please indicate an indexing number like it appears in your quest list.`, 'red')

    const resp = []
    const quest = ctx.quests.daily.find(x => user.dailyquests[index] === x.id)
    resp.push(`Tier: \`${new Array(quest.tier + 1).join('★')}\``)
    resp.push(`Required user level: **${quest.min_level}**`)
    resp.push(`Reward: ${quest.reward(ctx)}`)

    return ctx.send(ctx.interaction, {
        color: colors.blue,
        author: { name: quest.name },
        description: resp.join('\n'),
        fields: [
            { name: 'Guide', value: quest.desc.replace(/->/gi, ctx.prefix) },
            { name: 'Related help', value: `This quest is completed using **${quest.actions[0]}** command. 
                For more information type: \`${ctx.prefix}help help_menu:${quest.actions[0]}\`` },
        ]
    }, user.discord_id)
}))

cmd('stats', withInteraction(async (ctx, user) => {
    const stats = await getStaticStats(ctx, user, user.lastdaily)
    const keys = _.keys(stats).filter(x => stats[x] !== 0)
    _.pull(keys, '_id', 'daily', 'discord_id', 'username', '__v')
    if (keys.length === 0 || keys.includes('Isnew'))
        return ctx.reply(user, `there are no statistics to display yet today!`)

    let table = new AsciiTable()
    table.setHeading('Stat', 'Count')
    keys.map(x => {
        const format = formatUserStats(x, stats[x])
        table.addRow(format.stat, numFmt(format.count))
    })

    return ctx.interaction.createMessage({embed: {
            color: colors.blue,
            author: { name: `${user.username}, your daily stats:` },
            description: `\`\`\`${table.toString()}\`\`\``
        }})

}))

cmd('achievements', withInteraction(async (ctx, user, args) => {
    let list = user.achievements.map(x => {
        const item = ctx.achievements.find(y => y.id === x)
        return `**${item.name}** • \`${item.desc}\`${item.hidden? ` • *Hidden*`: ''}`
    })

    const miss = args.missing
    let missDiff

    if (miss) {
        list = ctx.achievements.filter(x => !user.achievements.some(y => x.id === y) && !x.hidden).map(z => `**${z.name}** • \`${z.desc}\``)
        missDiff = ctx.achievements.filter(x => !user.achievements.some(y => x.id === y) && x.hidden).length
    }

    const embed = {author: { name: `${user.username}, ${miss? 'missing' : 'completed'} achievements: (${list.length}${miss? ` + ${missDiff} Hidden`: ''})` }}

    if (!miss)
        embed.footer = {text: `To see achievements you don't have, use ${ctx.prefix}achievements missing:true`}

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
        - [Vote on top.gg](${ctx.dbl.topggUrl}) to get **free cards** (${future > now? topggTime : `ready`})
        - [Vote on Discord Bot List](${ctx.dbl.dblUrl}) to get **free ${ctx.symbols.tomato}**`,
        
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
    const now = new Date()
    const futureDaily = asdate.add(user.lastdaily, await check_effect(ctx, user, 'rulerjeanne')? 17 : 20, 'hours')
    const futureVote = asdate.add(user.lastvote, 12, 'hours')
    const daily = futureDaily < now
    const vote = futureVote < now
    const claim = stats.claims === 0
    const quest = user.dailyquests.length > 0
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
