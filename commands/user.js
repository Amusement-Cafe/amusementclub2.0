const msToTime          = require('pretty-ms')
const {cmd}             = require('../utils/cmd')
const colors            = require('../utils/colors')
const asdate            = require('add-subtract-date')
const _                 = require('lodash')

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
} = require("../modules/plot");

cmd('bal', 'balance', (ctx, user) => {
    let max = 1
    const now = new Date()
    const promo = ctx.promos.find(x => x.starts < now && x.expires > now)
    if(ctx.guild) {
        while(claimCost(user, ctx.guild.tax, max) < user.exp)
            max++
    } else {
        while(claimCost(user, 0, max) < user.exp)
            max++
    }

    const embed = {
        color: colors.green,
        description: `you have **${numFmt(Math.round(user.exp))}** ${ctx.symbols.tomato}, **${numFmt(Math.round(user.vials))}** ${ctx.symbols.vial} and **${numFmt(Math.round(user.lemons))}** ${ctx.symbols.lemon}
            Your next claim will cost **${numFmt(claimCost(user, 0, 1))}** ${ctx.symbols.tomato}
            ${ctx.guild? `Next claim in current guild: **${numFmt(claimCost(user, ctx.guild.tax, 1))}** ${ctx.symbols.tomato} (+${ctx.guild.tax * 100}% claim tax)`:''}
            You can claim **${numFmt(max - 1)} cards** ${ctx.guild? `in current guild `:''}with your balance`
    }

    if(promo) {
        max = 1
        while(promoClaimCost(user, max) < user.promoexp)
            max++

        embed.fields = [{
            name: `Promo balance`,
            value: `You have **${numFmt(Math.round(user.promoexp))}** ${promo.currency}
                Your next claim will cost **${numFmt(promoClaimCost(user, 1))}** ${promo.currency}
                You can claim **${numFmt(max - 1)} ${promo.name} cards** with your balance`
        }]
    }

    return ctx.reply(user, embed)
}).access('dm')

cmd('inv', withUserItems((ctx, user, items, args) => {
    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(items.map((x, i) => `${i+1}. \`${x.id}\` **${x.name}** (${x.type.replace(/_/, ' ')})`), 5),
        switchPage: (data) => data.embed.fields[1].value = data.pages[data.pagenum],
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, your inventory` },
            fields: [
                { name: `Usage`, value: `To view the item details use \`->inv info [item id]\`
                    To use the item \`->inv use [item id]\`` },
                { name: `List (${items.length} results)`, value: '' }
            ],
            color: colors.blue,
        }
    })
}))

cmd(['inv', 'use'], withUserItems(async (ctx, user, items, args) => {
    const item = items[0]
    const itemCheck = await checkItem(ctx, user, item)

    if(itemCheck)
        return ctx.reply(user, itemCheck, 'red')

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        force: ctx.globals.force,
        question: getQuestion(ctx, user, item),
        onConfirm: (x) => useItem(ctx, user, item)
    })
}))

cmd(['inv', 'info'], withUserItems((ctx, user, items, args) => {
    const item = items[0]

    const embed = itemInfo(ctx, user, item)
    embed.color = colors.blue
    embed.author = { name: `${item.name} (${item.type.replace(/_/, ' ')})` }

    if(item.col)
        embed.description += `\nThis ticket is for collection \`${item.col}\``

    return ctx.send(ctx.msg.channel.id, embed)
}))

cmd('daily', async (ctx, user) => {
    user.lastdaily = user.lastdaily || new Date(0)

    const now = new Date()
    const future = asdate.add(user.lastdaily, check_effect(ctx, user, 'rulerjeanne')? 17 : 20, 'hours')

    if(future < now) {
        const quests = []
        let amount = 500
        const promoAmount = 500 + ((user.dailystats.promoclaims * 50) || 0)
        const promo = ctx.promos.find(x => x.starts < now && x.expires > now)
        const boosts = ctx.boosts.filter(x => x.starts < now && x.expires > now)
        const hero = await get_hero(ctx, user.hero)

        if(check_effect(ctx, user, 'cakeday')) {
            amount += 100 * (user.dailystats.claims || 0)
        }

        if (promo) {
            user.promoexp += promoAmount
        }

        user.lastdaily = now
        user.dailystats = {}
        user.exp += amount
        user.xp += 10
        user.dailyquests = []
        user.markModified('dailystats')

        quests.push(getQuest(ctx, user, 1))
        user.dailyquests.push(quests[0].id)

        quests.push(getQuest(ctx, user, 2, quests[0].id))
        user.dailyquests.push(quests[1].id)

        user.markModified('dailyquests')

        addGuildXP(ctx, user, 10)
        ctx.guild.balance += XPtoLEVEL(user.xp)
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
                value: `${promo? `[${msToTime(promo.expires - now, {compact: true})}] **${promo.name}** event (\`->claim promo\`)` : ''}
                ${boosts.map(x => 
                `[${msToTime(x.expires - now, {compact: true})}] **${x.rate * 100}%** drop rate for **${x.name}** when you run \`->claim ${x.id}\``).join('\n')}`
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
            name: `Get rewarded`,
            value: `Don\'t forget to vote for the bot every day and get in-game rewards. Check \`->vote\` for more information.`,
        })

        user.dailynotified = false
        await user.save()
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

    return ctx.reply(user, `you can claim your daily in **${msToTime(future - now)}**`, 'red')
})

cmd('cards', 'li', 'ls', 'list', withCards(async (ctx, user, cards, parsedargs) => {
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

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(cardstr, 15),
        embed: { author: { name: `${user.username}, your cards (${numFmt(cards.length)} results)` } }
    })
})).access('dm')

cmd('favs', withCards(async (ctx, user, cards, parsedargs) => {
    const now = new Date()
    cards = cards.filter(x => x.fav)
    const cardstr = cards.map(c => {
        const isnew = c.obtained > (user.lastdaily || now)
        return (isnew? '**[new]** ' : '') + formatName(c) + (c.amount > 1? ` (x${numFmt(c.amount)}) ` : ' ') + (c.rating? `[${c.rating}/10]` : '')
    })

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(cardstr, 15),
        embed: { author: { name: `${user.username}, your cards (${numFmt(cards.length)} results)` } }
    })
})).access('dm')

cmd('profile', async (ctx, user, ...args) => {
    const pargs = parseArgs(ctx, args)
    if(pargs.ids.length > 0) user = await fetchOnly(pargs.ids[0])

    if(!user)
        return ctx.send(ctx.msg.channel.id, {
            description: `Cannot find user with ID ${pargs.ids[0]}`,
            color: colors.red
        })

    const completedSum = user.completedcols.length
    const cloutsum = user.cloutedcols.map(x => x.amount).reduce((a, b) => a + b, 0)
    const stamp = user.joined || user._id.getTimestamp()
    const cards = mapUserCards(ctx, user)
    const stampString = `${stamp.getFullYear()}.${(stamp.getMonth()+1)}.${stamp.getDate()}`
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
    resp.push(`Cards: **${numFmt(user.cards.length)}** | Stars: **${numFmt(cards.map(x => x.level).reduce((a, b) => a + b, 0))}**`)

    if (pargs.ids.length > 0 && !isNaN(price)) {
        resp.push(`Cards Worth: **${numFmt(price)}** ${ctx.symbols.tomato} or **${numFmt(vials)} ${ctx.symbols.vial}**`)
    } else if (!isNaN(price)) {
        resp.push(`Net Worth: **${numFmt(price + user.exp)}** ${ctx.symbols.tomato} or **${numFmt(vials + user.vials)} ${ctx.symbols.vial}**`)
    } else {
        const evalTime = getQueueTime()
        resp.push(`Worth: **Calculating , try again in ${msToTime(evalTime)}**`)
    }

    resp.push(`In game since: **${stampString}** (${msToTime(new Date() - stamp, {compact: true})})`)

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
    return ctx.send(ctx.msg.channel.id, {
        description: resp.join('\n'),
        color: colors['yellow'],
        author: {
            name: `${user.username} (${user.discord_id})`
        },
        thumbnail: {
            url: botuser? botuser.avatarURL : ''
        }
    }, user.discord_id)
}).access('dm')

cmd('diff', async (ctx, user, ...args) => {
    const newArgs = parseArgs(ctx, args, user)

    if(!newArgs.ids[0])
        return ctx.qhelp(ctx, user, 'diff')

    const otherUser = await fetchOnly(newArgs.ids[0])
    if(!otherUser)
        return ctx.reply(user, `could not find target user`, 'red')

    let otherCards = filter(mapUserCards(ctx, otherUser), newArgs)

    if(otherCards.length === 0)
        return ctx.reply(user, `**${otherUser.username}** doesn't have any cards matching this request`, 'red')

    if(newArgs.tags.length > 0) {
        const tgcards = await fetchTaggedCards(newArgs.tags)
        otherCards = otherCards.filter(x => tgcards.includes(x.id))
    }

    if(newArgs.antitags.length > 0) {
        const tgcards = await fetchTaggedCards(newArgs.antitags)
        otherCards = otherCards.filter(x => !tgcards.includes(x.id))
    }

    const ids = user.cards.map(x => x.id)
    const diff = otherCards.filter(x => ids.indexOf(x.id) === -1)
        .filter(x => x.fav && x.amount == 1 && !newArgs.fav? x.id === -1 : x)
        .sort(newArgs.sort)

    if(diff.length === 0)
        return ctx.reply(user, `no different cards found`, 'red')

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(diff.map(x => `${formatName(x)} ${x.amount > 1? `(x${x.amount})`: ''} ${x.rating? `[${x.rating}/10]` : ''}`), 15),
        embed: { author: { name: `${user.username}, unique cards FROM ${otherUser.username} (${numFmt(diff.length)} results)` } }
    })
})

cmd(['diff', 'reverse'], ['diff', 'rev'], async (ctx, user, ...args) => {
    const newArgs = parseArgs(ctx, args, user)

    if(!newArgs.ids[0])
        return ctx.qhelp(ctx, user, 'diff')

    const otherUser = await fetchOnly(newArgs.ids[0])
    if(!otherUser)
        return ctx.reply(user, 'cannot find user with that ID', 'red')

    const otherCards = otherUser.cards
    let mappedCards = filter(mapUserCards(ctx, user), newArgs)

    if(otherCards.length === 0)
        return ctx.reply(user, `**${otherUser.username}** doesn't have any cards matching this request`, 'red')

    if(newArgs.tags.length > 0) {
        const tgcards = await fetchTaggedCards(newArgs.tags)
        mappedCards = mappedCards.filter(x => tgcards.includes(x.id))
    }

    if(newArgs.antitags.length > 0) {
        const tgcards = await fetchTaggedCards(newArgs.antitags)
        mappedCards = mappedCards.filter(x => !tgcards.includes(x.id))
    }

    const ids = otherCards.map(x => x.id)
    const diff = mappedCards.filter(x => ids.indexOf(x.id) === -1)
        .filter(x => x.fav && x.amount == 1 && !newArgs.fav? x.id === -1 : x)
        .sort(newArgs.sort)

    if(diff.length === 0)
        return ctx.reply(user, `no different cards found`, 'red')

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(diff.map(x => `${formatName(x)} ${x.amount > 1? `(x${x.amount})`: ''} ${x.rating? `[${x.rating}/10]` : ''}`), 15),
        embed: { author: { name: `${user.username}, unique cards FOR ${otherUser.username} (${numFmt(diff.length)} results)` } }
    })
})

cmd('has', async (ctx, user, ...args) => {
    const newArgs = parseArgs(ctx, args, user)

    if(!newArgs.ids[0])
        return ctx.qhelp(ctx, user, 'has')

    if(user.discord_id == newArgs.ids[0])
        return ctx.reply(user, 'you can use ->cards to see your own cards', 'red')

    const otherUser = await fetchOnly(newArgs.ids[0])
    if(!otherUser)
        return ctx.reply(user, 'cannot find user with that ID', 'red')

    const otherCards = filter(mapUserCards(ctx, otherUser), newArgs)

    if (otherCards.length === 0)
        return ctx.reply(user, `**${otherUser.username}** doesn't have that card.`, 'red')

    if (newArgs.filters.length === 0 || otherCards.map(x=> `${formatName(x)}`).length > 1) {
        return ctx.reply(user, 'Please specify a single card to match', 'red')
    }
    return ctx.reply(user, `Matched card ${otherCards.map(x => `${formatName(x)} ${x.fav? 'and it is marked as **favorite**': ''}`)}`)
})

cmd('miss', withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const ids = user.cards.map(x => x.id)
    const diff = cards.filter(x => ids.indexOf(x.id) === -1)
        .filter(x => !x.excluded)
        .sort(parsedargs.sort)

    if(diff.length === 0)
        return ctx.reply(user, `you have all cards matching this request!`)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(diff.map(x => formatName(x)), 15),
        embed: { author: { name: `${user.username}, cards that you don't have (${numFmt(diff.length)} results)` } }
    })
}))

cmd('quest', 'quests', async (ctx, user) => {
    if(user.dailyquests.length === 0 && user.questlines.length === 0)
        return ctx.reply(user, `you don't have any quests`, 'red')

    return ctx.send(ctx.msg.channel.id, {
        color: colors.blue,
        author: { name: `${user.username}, your quests:` },
        description: ctx.quests.daily.filter(x => user.dailyquests.some(y => x.id === y))
            .map((x, i) => `${i + 1}. \`${new Array(x.tier + 1).join('★')}\` ${x.name} (${x.reward(ctx)})`).join('\n')
    }, user.discord_id)
})

cmd('stats', async (ctx, user) => {
    const keys = Object.keys(user.dailystats).filter(x => user.dailystats[x] > 0 && user.dailystats[x] !== true)

    if(keys.length === 0)
        return ctx.reply(user, `no statistics to display today`)

    return ctx.send(ctx.msg.channel.id, {
        color: colors.blue,
        author: { name: `${user.username}, your daily stats:` },
        description: keys.map(x => `${cap(x)}: **${user.dailystats[x]}**`).join('\n')
    }, user.discord_id)
})

cmd('achievements', 'ach', async (ctx, user) => {
    const list = user.achievements.map(x => {
        const item = ctx.achievements.find(y => y.id === x)
        return `**${item.name}** (${item.desc})`
    })

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(list, 15),
        embed: { author: { name: `${user.username}, completed achievements: (${list.length})` } }
    })
})

cmd('vote', async (ctx, user) => {
    const now = new Date()
    const future = asdate.add(user.lastvote, 12, 'hours')
    const topggTime = msToTime(future - now, { compact: true })

    return ctx.send(ctx.msg.channel.id, {
        color: colors.blue,
        description: `You can vote for Amusement Club **every 12 hours** and get rewards.
        Make sure you have allowed messages from server memebers in order to receive rewards in DMs.
        - [Vote on top.gg](${ctx.dbl.topggUrl}) to get **free cards** (${future > now? topggTime : `ready`})
        - [Vote on Discord Bot List](${ctx.dbl.dblUrl}) to get **free ${ctx.symbols.tomato}**`,
        
        fields: [
            {
                name: `Get notified`,
                value: `You can enable bot notifications to let you know that it is time to vote. 
                Simply run \`${ctx.prefix}prefs set notify vote true\``
            }
        ]
    }, user.discord_id)
}).access('dm')
