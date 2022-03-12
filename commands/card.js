const {cmd}         = require('../utils/cmd')
const colors        = require('../utils/colors')

const User          = require('../collections/user')
const UserCard      = require('../collections/userCard')
const Claim         = require('../collections/claim')

const _             = require('lodash')
const msToTime      = require('pretty-ms')
const dateFormat    = require('dateformat')

const {
    claimCost, 
    promoClaimCost,
    generateNextId,
    numFmt,
    findCardsFast,
    formatDateTimeRelative,
    XPtoLEVEL,
} = require('../utils/tools')

const {
    evalCard, 
    getVialCost,
    getQueueTime,
    evalCardFast,
    bulkIncrementUserCount,
    getVialCostFast,
    pushUserCountUpdate,
} = require('../modules/eval')

const {
    new_trs,
    confirm_trs,
    decline_trs,
    validate_trs,
} = require('../modules/transaction')

const {
    formatName,
    withCards,
    withGlobalCards,
    bestMatch,
} = require('../modules/card')

const {
    addGuildXP,
} = require('../modules/guild')

const {
    check_effect,
} = require('../modules/effect')

const {
    fetchInfo,
} = require('../modules/meta')

const {
    plotPayout,
} = require('../modules/plot')

const { 
    getUserCards,
    addUserCards,
    fetchOnly,
} = require('../modules/user')

const {
    withInteraction,
} = require("../modules/interactions")

const {
    getStats,
    saveAndCheck,
} = require("../modules/userstats")

const {
    completed,
} = require("../modules/collection")

cmd(['claim', 'cards'], withInteraction(async (ctx, user, args) => {
    const cards = []
    const now = new Date()

    let promo, boost, any
    if(args.promo) {
        promo = ctx.promos.find(x => x.starts < now && x.expires > now)
        if(!promo)
            return ctx.reply(user, `no events are running right now. Please use regular claim`, 'red')
    }

    if (args.any) {
        any = true
    }

    let stats = await getStats(ctx, user, user.lastdaily)
    const amount = args.count || 1
    const price = promo? promoClaimCost(user, amount, stats.promoclaims) : claimCost(user, ctx.guild.tax, amount, stats.claims)
    const normalprice = promo? price : claimCost(user, 0, amount, stats.claims)
    const curboosts = ctx.boosts.filter(x => x.starts < now && x.expires > now)
    const activepromo = ctx.promos.find(x => x.starts < now && x.expires > now)
    const userCards = await getUserCards(ctx, user)

    if(amount > 10)
        return ctx.reply(user, `you can claim only **10** or less cards with one command`, 'red')

    if(!promo && price > user.exp)
        return ctx.reply(user, `you need **${numFmt(price)}** ${ctx.symbols.tomato} to claim **${amount > 1? amount + '** cards' : 'a card'}. 
            You have **${numFmt(Math.floor(user.exp))}** ${ctx.symbols.tomato}
            ${user.dailyquests.length > 0? `Complete your \`${ctx.prefix}quests\` to get more ${ctx.symbols.tomato}` : ''}
            Use \`${ctx.prefix}daily\` to reset your claim price and get extra ${ctx.symbols.tomato}`, 'red')

    if(promo && price > user.promoexp)
        return ctx.reply(user, `you need **${numFmt(price)}** ${promo.currency} to claim **${amount > 1? amount + '** cards' : 'a card'}. 
            You have **${numFmt(Math.floor(user.promoexp))}** ${promo.currency}
            Claim regular cards using \`${ctx.prefix}claim\` or run \`${ctx.prefix}daily\` when it is ready to obtain more ${promo.currency}`, 'red')

    if(!promo && args.boostID) {
        boost = curboosts.find(x => x.id === args.boostID.toLowerCase())
    }

    if(!promo && !any && !boost && !amount) {
        return ctx.reply(user, `unknown claim argument \`${args.boostID}\`!
            Please specify a number, boost ID, 'promo' (if there are promotions running) or 'any' (if current server is locked).
            For more information type \`${ctx.prefix}help claim\`
            To view boost IDs use \`${ctx.prefix}boosts\``, 'red')
    }

    const lock = (ctx.guild.overridelock && !any? ctx.guild.overridelock: null) || (ctx.guild.lockactive && !any? ctx.guild.lock : null)
    const tohruEffect = (!stats.totalregclaims || stats.totalregclaims === 0) && await check_effect(ctx, user, 'tohrugift')
    for (let i = 0; i < amount; i++) {
        const rng = Math.random()
        const spec = _.sample(ctx.collections.filter(x => x.rarity > rng))
        const col = promo || spec || (lock? ctx.collections.find(x => x.id === lock) 
            : _.sample(ctx.collections.filter(x => !x.rarity && !x.promo)))
        let card, boostDrop = false
        const colCards = ctx.cards.filter(x => x.col === col.id)
        if(i === 0 && tohruEffect && colCards.some(x => x.level === 3)) {
            card = _.sample(colCards.filter(x => x.level === 3 && !x.excluded))
        }
        else if(boost && rng < boost.rate) {
            boostDrop = true
            card = ctx.cards[_.sample(boost.cards)]
        }
        else card = _.sample(colCards.filter(x => x.level < 5 && !x.excluded))

        const userCard = userCards.find(x => x.cardid === card.id)
        const alreadyClaimed = cards.filter(x => x.userCard === userCard).length
        const count = userCard? (alreadyClaimed + 1) + userCard.amount: 1

        cards.push({ 
            count,
            boostDrop, 
            card,
            userCard
        })
    }
    
    cards.sort((a, b) => b.card.level - a.card.level)

    let totalPossible = 0
    let curr = ctx.symbols.tomato, max = 1
    const extra = Math.round(price * .25)
    const newCards = cards.filter(x => x.count === 1)
    const oldCards = cards.filter(x => x.count > 1)

    if(promo) {
        curr = promo.currency
        user.promoexp -= price
        stats.promoout += price
        stats.promoclaims += amount

        while(promoClaimCost(user, max, stats.promoclaims) < user.promoexp)
            max++

    } else {
        user.exp -= price
        if (activepromo){
            user.promoexp += extra
            stats.promoin += extra
        }
        stats.claims += amount
        stats.totalregclaims += amount
        stats.tomatoout += price
        await plotPayout(ctx, 'gbank', 2, Math.floor(amount * 1.5))

        while(claimCost(user, ctx.guild.tax, max, stats.claims) < user.exp)
            max++
    }

    user.lastcard = cards[0].card.id
    user.xp += amount
    await user.save()

    await addUserCards(ctx, user, cards.map(x => x.card.id))
    await completed(ctx, user, cards.map(x => x.card.id))

    if(newCards.length > 0) {
        await bulkIncrementUserCount(ctx, newCards.map(x => x.card.id))
    }

    if(price != normalprice) {
        ctx.guild.balance += Math.round(price - normalprice)
    }


    await addGuildXP(ctx, user, amount)
    await ctx.guild.save()

    const receipt = []
    receipt.push(`Total spent: **${numFmt(price)}** ${curr} | Remaining: **${numFmt(Math.round(promo? user.promoexp : user.exp))}** ${curr}`)

    // if(recommendedClaims == 0) {
    //     receipt.push(`**Reached maximum recommended amount of claims today.**`)
    //     receipt.push(`Claim cost: **${promo? numFmt(promoClaimCost(user, 1)) : numFmt(claimCost(user, ctx.guild.tax, 1))}** ${curr}`)
    // } else {
    // }

    const curClaimCount = promo? stats.promoclaims : stats.claims
    const nextClaim = promo? numFmt(promoClaimCost(user, 1, stats.promoclaims)) : numFmt(claimCost(user, ctx.guild.tax, 1, stats.claims))
    receipt.push(`Claimed **${curClaimCount}** card(s) today | Next claim **${nextClaim}** ${curr}`)

    if(activepromo && !promo) {
        receipt.push(`Got **+${numFmt(extra)}** ${activepromo.currency} | You have: **${numFmt(user.promoexp)}** ${activepromo.currency}`)
    }

    let fields = []
    let description = `**${user.username}**, you got:`
    fields.push({name: `New cards`, value: newCards.map(x => `${x.boostDrop? '`🅱` ' : ''}${formatName(x.card)}`).join('\n')})
    fields.push({name: `Duplicates`, value: oldCards.map(x => `${x.boostDrop? '`🅱` ' : ''}${formatName(x.userCard? Object.assign({}, ctx.cards[x.userCard.cardid], x.userCard): x.card)} #${x.count}`).join('\n')})
    // fields.push({name: `Receipt`, value: receipt.join('\n') })
    fields.push({name: `Receipt`, value: `You spent **${numFmt(price)}** ${curr} in total
        You have **${numFmt(Math.round(promo? user.promoexp : user.exp))}** ${curr} left
        You can claim **${max - 1}** more cards
        Your next claim will cost **${promo? numFmt(promoClaimCost(user, 1, stats.promoclaims)) : numFmt(claimCost(user, ctx.guild.tax, 1, stats.claims))}** ${curr}
        ${activepromo && !promo? `You got **${numFmt(extra)}** ${activepromo.currency}
        You now have **${numFmt(user.promoexp)}** ${activepromo.currency}` : ""}`.replace(/\s\s+/gm, '\n')})

    if (amount > 1 && XPtoLEVEL(user.xp) < 15) {
        fields.push({name: `View your cards`, value:
            `Use \`${ctx.prefix}sum [card name]\` to view the card
            (e.g. \`${ctx.prefix}sum ${cards[0].card.name}\`)
            Use \`${ctx.prefix}card info [card name]\` to view the card tags and metadata
            (e.g. \`${ctx.prefix}card info ${cards[0].card.name}\`)`})
    }
    /*fields.push({name: `External view`, value:
        `[view your claimed cards here](http://noxcaos.ddns.net:3000/cards?type=claim&ids=${cards.map(x => x.card.id).join(',')})`})*/

    fields = fields.map(x => {
        if(x.value.length < 1024)
            return x

        description += `\n**${x.name}**\n${x.value}`
    }).filter(x => x && x.value)

    const lastClaim = await Claim.findOne().sort({_id: 'desc'}).lean()

    const claimInfo = new Claim()
    claimInfo.id = lastClaim? generateNextId(lastClaim.id, 6) : generateNextId('aaaaaa', 6)
    claimInfo.user = user.discord_id
    claimInfo.guild = ctx.guild.id
    claimInfo.cost = price
    claimInfo.promo = promo != undefined
    claimInfo.lock = lock
    claimInfo.date = new Date()
    claimInfo.cards = cards.map(x => x.card.id)
    await claimInfo.save()

    const pages = newCards.concat(oldCards).map(x => x.card.url)
    await saveAndCheck(ctx, user, stats)
    return ctx.sendPgn(ctx, user, {
        pages,
        buttons: ['back', 'forward'],
        switchPage: (data) => data.embed.image.url = data.pages[data.pagenum],
        embed: {
            color: colors.blue,
            description,
            fields,
            image: { url: '' }
        }
    }, false)
}))

cmd(['claim', 'history'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const claimHistory = await Claim.find(
        { user: user.discord_id }, 
        { cards: 1, date: 1, id: 1 }, 
        { sort: { date: -1 }, limit: 100 })
        .lean()

    let aggregation = claimHistory.reduce((arr, x) => { 
        x.cards.map(c => arr.push({ date: x.date, card: c, id: x.id }))
        return arr
    }, [])

    if(!parsedargs.isEmpty()) {
        aggregation = findCardsFast(aggregation, cards, 'card')
    }
    
    if(aggregation.length === 0) {
        return ctx.reply(user, `no matching claims found`, 'red')
    }

    return ctx.sendPgn(ctx, user, {
        pages: ctx.pgn.getPages(aggregation.map(x => `\`${x.id}\` ${formatDateTimeRelative(x.date)} ${formatName(ctx.cards[x.card])}`), 10),
        embed: {
            author: { name: `Matched (${numFmt(aggregation.length)} card(s) from ${numFmt(claimHistory.length)} claim(s))` },
        }
    })
}))).access('dm')

cmd(['claim', 'info'], withInteraction(async (ctx, user, args) => {
    const claim = await Claim.findOne({ id: args.claimID, user: user.discord_id })

    if(!claim)
        return ctx.reply(user, `claim with ID \`${args.claimID}\` was not found`, 'red')

    const guild = ctx.bot.guilds.get(claim.guild)
    const resp = []
    resp.push(`Cards: **${claim.cards.length}**`)
    resp.push(`Price: **${numFmt(claim.cost)}** ${ctx.symbols.tomato}`)

    if(guild) {
        resp.push(`Guild: **${guild.name}**`)
    }

    if(claim.lock) {
        resp.push(`With lock to: **${claim.lock}**`)
    }
    
    resp.push(formatDateTimeRelative(claim.date))

    return ctx.send(ctx.interaction, {
        author: { name: `Claim [${claim.id}] by ${user.username}` },
        description: resp.join('\n'),
        color: colors.blue,
        fields: [{
            name: "Cards",
            value: claim.cards.map(c => formatName(ctx.cards[c])).join('\n')
        }]
    }, user.discord_id)
}))

cmd('summon', withInteraction(withCards(async (ctx, user, cards, parsedargs) => {
    const card = parsedargs.isEmpty()? _.sample(cards) : bestMatch(cards)
    user.lastcard = card.id
    await user.save()

    let warn = `> This is a random card **that you own**.\nFor more info type \`${ctx.prefix}help summon\``
    let lvl = XPtoLEVEL(user.xp)

    if(card.imgur) {
        await ctx.reply(user, {
            color: colors.blue,
            description: `summons **${formatName(card)}**!`
        })

        return ctx.bot.createMessage(ctx.interaction.channel.id, card.imgur)
    }

    return ctx.reply(user, {
        image: { url: card.url },
        color: colors.blue,
        description: `summons **${formatName(card)}**!\n${parsedargs.isEmpty() && lvl < 25? warn : ''}`
    })
}))).access('dm')

cmd(['cards', 'global'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs) => {
    cards = cards.filter(x => !x.excluded)

    const evalTime = getQueueTime()
    if(evalTime > 0 && parsedargs.evalQuery) {
        ctx.reply(user, {
            color: colors.yellow,
            description: `current result might not be accurate because some of the cards are still processing their eval.
                Please check in **${msToTime(evalTime)}** for more accurate results.`
        })
    }

    return ctx.sendPgn(ctx, user, {
        pages: ctx.pgn.getPages(cards.map(c => `${formatName(c)}${parsedargs.evalQuery? ` ${evalCardFast(ctx, c)}${ctx.symbols.tomato}`: ''}`), 15),
        embed: {
            author: { name: `Matched cards from database (${numFmt(cards.length)} results)` },
        }
    })
}))).access('dm')

cmd(['sell', 'one'], withInteraction(withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'sell')

    const id = parsedargs.ids[0]
    const targetuser = id? await User.findOne({ discord_id: id }) : null

    if (targetuser && parsedargs.missing) {
        const otherCards = await getUserCards(ctx, targetuser)
        const otherIDs = otherCards.map(x => x.cardid)
        cards = cards.filter(x => otherIDs.indexOf(x.cardid) === -1)
            .filter(x => x.fav && x.amount == 1 && !parsedargs.fav? x.cardid === -1 : x)
            .sort(parsedargs.sort)
    }

    const card = bestMatch(cards)
    const err = await validate_trs(ctx, user, [card], id, targetuser)
    if(err) {
        return ctx.reply(user, err, 'red')
    }
    const perms = { confirm: [id], decline: [user.discord_id, id] }
    const price = await evalCard(ctx, card, targetuser? 1 : .4)
    const trs = await new_trs(ctx, user, [card], price, targetuser? targetuser.discord_id : null)

    let question = ""
    if(trs.to != 'bot') {
        question = `**${trs.to}**, **${trs.from}** wants to sell you **${formatName(card)}** for **${numFmt(price)}** ${ctx.symbols.tomato}`
    } else {
        question = `**${trs.from}**, do you want to sell **${formatName(card)}** to **bot** for **${numFmt(price)}** ${ctx.symbols.tomato}?`
        perms.confirm.push(user.discord_id)
    }

    return ctx.sendCfm(ctx, user, {
        embed: { footer: { text: `ID: \`${trs.id}\`` } },
        force: trs.to === 'bot'? ctx.globals.force : false,
        question,
        perms,
        onConfirm: (x) => confirm_trs(ctx, x, trs.id, true),
        onDecline: (x) => decline_trs(ctx, x, trs.id, true),
        onTimeout: (x) => ctx.pgn.sendTimeout(ctx.interaction, `**${trs.from}** tried to sell **${formatName(card)}** to **${trs.to}**. This is now a pending transaction with ID \`${trs.id}\``)
    })
})))

cmd(['sell', 'many'], withInteraction(withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'sell')

    const id = parsedargs.ids[0]
    const targetuser = id? await User.findOne({ discord_id: id }) : null

    if (targetuser && parsedargs.missing) {
        const otherCards = await getUserCards(ctx, targetuser)
        const otherIDs = otherCards.map(x => x.cardid)
        cards = cards.filter(x => otherIDs.indexOf(x.cardid) === -1)
            .filter(x => x.fav && x.amount == 1 && !parsedargs.fav? x.cardid === -1 : x)
            .sort(parsedargs.sort)
    }

    let err = await validate_trs(ctx, user, cards, id, targetuser)
    if(err) {
        err += 'This list stops at 10 and does not display any more favorites. Please double check your favorites before continuing, or add `!fav` to your query.'
        return ctx.reply(user, err, 'red')
    }

    const perms = { confirm: [id], decline: [user.discord_id, id], switch: [user.discord_id, id] }

    let price = 0
    const cardList = cards.map(card => {
        const eval = evalCardFast(ctx, card) * (targetuser? 1 : .4)
        if(eval >= 1) {
            price += Math.round(eval)
        } else {
            price = NaN
            pushUserCountUpdate(card)
        }
        card.fav = false
        return formatName(card)
    })

    if(isNaN(price)) {
        const evalTime = getQueueTime()
        return ctx.reply(user, `some cards from this request need price evaluation.
            Please try again in **${msToTime(evalTime)}**.`, 'yellow')
    }

    const trs = await new_trs(ctx, user, cards, price, targetuser? targetuser.discord_id : null)

    let question = ""
    if(trs.to != 'bot') {
        question = `**${trs.to}**, **${trs.from}** wants to sell you **${cards.length} cards** for **${numFmt(price)}** ${ctx.symbols.tomato}`
    } else {
        question = `**${trs.from}**, do you want to sell **${cards.length} cards** to **bot** for **${numFmt(price)}** ${ctx.symbols.tomato}?`
        perms.confirm.push(user.discord_id)
    }

    const embed = {
        title: question,
        color: colors.yellow
    }

    return ctx.sendCfmPgn(ctx, user, {
        pages: ctx.pgn.getPages(cardList, 10),
        embed: embed,
        force: ctx.globals.force,
        buttons: ['first', 'back', 'forward', 'last', 'confirm', 'decline'],
        question,
        perms,
        switchPage: (data) => {
            const page = data.pages[data.pagenum]
            data.embed.description = data.pages[data.pagenum]
            data.embed.footer = {text: `${data.pagenum + 1}/${data.pages.length} || Transaction ID: ${trs.id}`}
        },
        onConfirm: (x) => confirm_trs(ctx, x, trs.id, true),
        onDecline: (x) => decline_trs(ctx, x, trs.id, true),
        onTimeout: (x) => ctx.reply(user, `you tried to sell **${cards.length}** cards to **${trs.to}**. This is now a pending transaction with ID \`${trs.id}\``, 'grey', true)
    })
})))

cmd(['sell', 'preview'], withInteraction(withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'sell')

    cards.splice(100, cards.length)

    const id = parsedargs.ids[0]
    const targetuser = id? await User.findOne({ discord_id: id }) : null


    let price = 0
    const resp = cards.map(card => {
        const eval = evalCardFast(ctx, card) * (targetuser? 1 : .4)
        if(eval >= 1) {
            price += Math.round(eval)
        } else {
            price = NaN
            pushUserCountUpdate(card)
        }

        return {
            eval,
            cardname: `**${eval.toFixed(0)}** ${ctx.symbols.tomato} - ${formatName(card)}`,
        }
    })

    if(isNaN(price)) {
        const evalTime = getQueueTime()
        return ctx.reply(user, `some cards from this request need price evaluation.
            Please try again in **${msToTime(evalTime)}**.`, 'yellow')
    }

    resp.sort((a, b) => b.eval - a.eval)

    return ctx.sendPgn(ctx, user, {
        pages: ctx.pgn.getPages(resp.map(x => x.cardname), 10),
        embed: {
            author: { name: `Sell all preview (total ${numFmt(price)} ${ctx.symbols.tomato})` },
            description: '',
            color: colors.blue,
        }
    })

})))

cmd(['eval', 'one'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'eval')

    const card = bestMatch(cards)
    const price = await evalCard(ctx, card)
    const vials = await getVialCost(ctx, card, price)
    const cardInfo = await fetchInfo(ctx, card.id)
    return ctx.reply(user,
        `card ${formatName(card)} is worth: **${numFmt(price)}** ${ctx.symbols.tomato} ${card.level < 4? `or **${numFmt(vials)}** ${ctx.symbols.vial}` : ``}
        ${cardInfo.aucevalinfo.evalprices.length > ctx.eval.aucEval.minSamples? `**This eval is taken as an average of auction prices!**`: ''}`)
}))).access('dm')

cmd(['eval', 'many'], withInteraction(withCards(async (ctx, user, cards, parsedargs) => {

    let price = 0
    let vials = 0
    cards.map(card => {
        const eval = evalCardFast(ctx, card)
        if(eval >= 1) {
            price += Math.round(eval) * card.amount
        } else {
            price = NaN
            pushUserCountUpdate(card)
        }
        if(card.level < 4 && eval > 0) {
            vials += getVialCostFast(ctx, card, eval) * card.amount
        }
    })
    
    if(isNaN(price)) {
        const evalTime = getQueueTime()
        return ctx.reply(user, {
            color: colors.yellow,
            description: `some of your cards are still processing their eval.
                Please check in **${msToTime(evalTime)}** for more accurate results.`
        }, 'yellow')
    }

    return ctx.reply(user, 
        `request contains **${numFmt(cards.length)}** of your cards worth **${numFmt(price)}** ${ctx.symbols.tomato} 
        ${vials > 0? `or **${numFmt(vials)}** ${ctx.symbols.vial} (for less than 4 stars)` : ``}`)
}))).access('dm')

cmd(['eval', 'many', 'global'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs) => {

    let price = 0
    let vials = 0
    cards.map(card => {
        const eval = evalCardFast(ctx, card)
        if(eval >= 0) {
            price += Math.round(eval)
        } else {
            price = NaN
        }
        if(card.level < 4 && eval > 0) {
            vials += getVialCostFast(ctx, card, eval)
        }
    })
    
    if(isNaN(price)) {
        const evalTime = getQueueTime()
        return ctx.reply(user, {
            color: colors.yellow,
            description: `some cards are still processing their eval.
                Please check in **${msToTime(evalTime)}** for more accurate results.`
        }, 'yellow')
    }

    return ctx.reply(user, 
        `your request contains **${numFmt(cards.length)}** cards worth **${numFmt(price)}** ${ctx.symbols.tomato} 
        ${vials > 0? `or **${numFmt(vials)}** ${ctx.symbols.vial} (for less than 4 stars)` : ``}`)
}))).access('dm')

cmd(['fav', 'one'], withInteraction(withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'fav')

    const unfaved = cards.filter(x => !x.fav)
    let card = bestMatch(unfaved)

    if(!card) {
        card = bestMatch(cards)
        return ctx.reply(user, `card ${formatName(card)} is already marked as favourite`, 'red')
    }

    await UserCard.updateOne({cardid: card.id, userid: user.discord_id}, {fav: true})

    return ctx.reply(user, `marked ${formatName(card)} as favourite`)
}))).access('dm')

cmd(['fav', 'many'], withInteraction(withCards(async (ctx, user, cards, parsedargs) => {
    cards = cards.filter(x => !x.fav)

    if(cards.length === 0)
        return ctx.reply(user, `all cards from that request are already marked as favourite`, 'red')

    return ctx.sendCfm(ctx, user, {
        embed: { footer: { text: `Favourite cards can be accessed with -fav` } },
        force: ctx.globals.force,
        question: `**${user.username}**, do you want to mark **${numFmt(cards.length)}** cards as favourite?`,
        onConfirm: async (x) => {
            const cardIds = cards.map(c => c.id)
            await UserCard.updateMany({userid: user.discord_id, cardid: { $in: cardIds }}, {fav: true})

            return ctx.reply(user, `marked **${numFmt(cards.length)}** cards as favourite`, 'green', true)
        }
    })
}))).access('dm')

cmd(['fav', 'remove', 'one'], withInteraction(withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'fav')

    const faved = cards.filter(x => x.fav)
    let card = bestMatch(faved)

    if(!card) {
        card = bestMatch(cards)
        return ctx.reply(user, `card ${formatName(card)} is not marked as favourite`, 'red')
    }

    await UserCard.updateOne({cardid: card.id, userid: user.discord_id}, {fav: false})

    return ctx.reply(user, `removed ${formatName(card)} from favourites`)
}))).access('dm')

cmd(['fav', 'remove', 'many'], withInteraction(withCards(async (ctx, user, cards, parsedargs) => {
    cards = cards.filter(x => x.fav)

    if(cards.length === 0)
        return ctx.reply(user, `no favourited cards found`, 'red')

    return ctx.sendCfm(ctx, user, {
        force: ctx.globals.force,
        question: `**${user.username}**, do you want to remove **${numFmt(cards.length)}** cards from favourites?`,
        onConfirm: async (x) => {
            const cardIds = cards.map(c => c.id)
            await UserCard.updateMany({userid: user.discord_id, cardid: { $in: cardIds }}, {fav: false})

            return ctx.reply(user, `removed **${numFmt(cards.length)}** cards from favourites`, 'green', true)
        }
    })
}))).access('dm')

cmd(['boost', 'list'], withInteraction((ctx, user) => {
    const now = new Date()
    const boosts = ctx.boosts
        .filter(x => x.starts < now && x.expires > now)
        .sort((a, b) => a.expires - b.expires)

    if(boosts.length === 0) {
        return ctx.reply(user, `no current boosts`, 'red')
    }

    const description = boosts.map(x => 
        `[${msToTime(x.expires - now, {compact: true})}] **${x.rate * 100}%** rate for **${x.name}** (\`${ctx.prefix}claim ${x.id}\`)`).join('\n')

    return ctx.send(ctx.interaction, {
        description,
        color: colors.blue,
        title: `Current boosts`
    }, user.discord_id)
})).access('dm')

cmd(['boost', 'info'], withInteraction((ctx, user, args) => {
    const now = new Date()
    const boost = ctx.boosts.find(x => x.id === args.boostID)

    if(!boost) {
        return ctx.reply(user, `boost with ID \`${args.boostID}\` was not found.`, 'red')
    }

    const list = []
    list.push(`Rate: **${boost.rate * 100}%**`)
    list.push(`Cards in pool: **${numFmt(boost.cards.length)}**`)
    list.push(`Command: \`${ctx.prefix}claim ${boost.id}\``)
    list.push(`Expires in **${msToTime(boost.expires - now)}**`)

    return ctx.sendPgn(ctx, user, {
        pages: ctx.pgn.getPages(boost.cards.map(c => formatName(ctx.cards[c])), 10, 1024),
        switchPage: (data) => data.embed.fields[0].value = data.pages[data.pagenum],
        embed: {
            author: { name: `${boost.name} boost` },
            description: list.join('\n'),
            color: colors.blue,
            fields: [{
                name: "You can get any of these cards:",
                value: ""
            }]
        }
    })
}))

cmd(['rate', 'one'], withInteraction(withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'rate')

    const rating = parsedargs.rating

    const card = bestMatch(cards)
    const info = fetchInfo(ctx, card.id)
    let stats = await getStats(ctx, user, user.lastdaily)
    if(card.rating) {
        const oldrating = card.rating
        info.ratingsum -= oldrating
        info.usercount--
    } else {
        stats.rates++
    }

    await UserCard.updateOne({cardid: card.id, userid: user.discord_id}, {rating: rating})
    info.ratingsum += rating
    info.usercount++

    await user.save()
    await info.save()
    await saveAndCheck(ctx, user, stats)

    return ctx.reply(user, `set rating **${rating}** for ${formatName(card)}`)
}))).access('dm')

cmd(['rate', 'remove', 'one'], withInteraction(withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'rate')

    const card = bestMatch(cards)
    const info = fetchInfo(ctx, card.id)
    if(card.rating) {
        const oldrating = card.rating
        await UserCard.updateOne({cardid: card.id, userid: user.discord_id}, {rating: 0})

        //These are only here because I ran into this causing a negative usercount/rating
        if (info.ratingsum != 0) {
            info.ratingsum -= oldrating
        }
        if (info.usercount != 0) {
            info.usercount--
        }
    } else {
        return ctx.reply(user, 'you have not set a rating for that card!', 'red')
    }

    user.markModified('cards')
    await user.save()
    await info.save()

    return ctx.reply(user, `removed rating for ${formatName(card)}`)
}))).access('dm')

cmd(['wish', 'list'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs) => {
    let targetUser
    if(parsedargs.ids[0]) {
        targetUser = await fetchOnly(parsedargs.ids[0])

        if(targetUser.wishlist.length === 0)
            return ctx.reply(user, `${targetUser.username}'s wishlist is empty!`)

        cards = cards.filter(x => targetUser.wishlist.some(y => y === x.id))

        if(cards.length === 0)
            return ctx.reply(user, `there aren't any cards in ${targetUser.username}'s wishlist that match this request`, 'red')

    } else {
        
        if(user.wishlist.length === 0)
            return ctx.reply(user, `your wishlist is empty. Use \`${ctx.prefix}wish add [card]\` to add cards to your wishlist`)

        cards = cards.filter(x => user.wishlist.some(y => y === x.id))

        if(cards.length === 0)
            return ctx.reply(user, `there aren't any cards in your wishlist that match this request`, 'red')

    }



    return ctx.sendPgn(ctx, user, {
        pages: ctx.pgn.getPages(cards.map(x => `${formatName(x)}`), 15),
        embed: { author: { name: `${user.username}, ${targetUser? `here is ${targetUser.username}'s` :`your`} wishlist (${numFmt(cards.length)} results)` } }
    })
}))).access('dm')

cmd(['wish', 'one'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs, args) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'wishlist')

    const userCards = await getUserCards(ctx, user)

    if (parsedargs.diff)
        cards = cards.filter(x => parsedargs.diff == 1 ^ userCards.some(y => y.cardid === x.id))

    const card = bestMatch(cards)

    if (!card)
        return ctx.reply(user, `no cards found matching \`${parsedargs.cardQuery}\``, 'red')

    if(user.wishlist.some(x => x === card.id)) {
        return ctx.reply(user, `you already have ${formatName(card)} in your wishlist.
            To remove is use \`${ctx.prefix}wish remove [card]\``, 'red')
    }

    const userHasCard = userCards.some(x => x.cardid === card.id)
    let stats = await getStats(ctx, user, user.lastdaily)
    user.wishlist.push(card.id)
    stats.wish++
    await user.save()
    await saveAndCheck(ctx, user, stats)

    return ctx.reply(user, `added ${formatName(card)} to the wishlist ${userHasCard? '(you own this card)' : ''}`)
}))).access('dm')

cmd(['wish', 'many'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'wishlist')

    cards = cards.filter(x => !user.wishlist.some(y => y === x.id))

    const userCards = await getUserCards(ctx, user)


    if (parsedargs.diff)
        cards = cards.filter(x => parsedargs.diff == 1 ^ userCards.some(y => y.cardid === x.id))

    if(cards.length === 0)
        return ctx.reply(user, `all cards from that request are already in your wishlist`, 'red')

    return ctx.sendCfm(ctx, user, {
        force: ctx.globals.force,
        question: `**${user.username}**, do you want add **${numFmt(cards.length)}** cards to your wishlist?`,
        onConfirm: async (_x) => {
            let stats = await getStats(ctx, user, user.lastdaily)
            cards.map(c => {
                stats.wish++
                user.wishlist.push(c.id)
            })
            await user.save()
            await saveAndCheck(ctx, user, stats)

            return ctx.reply(user, `added **${numFmt(cards.length)}** cards to your wishlist`, 'green', true)
        }
    })
}))).access('dm')

cmd(['wish', 'remove', 'one'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'wishlist')

    if(user.wishlist.length === 0) {
        return ctx.reply(user, `your wishlist is empty. Use \`${ctx.prefix}wish add [card]\` to add cards to your wishlist`, 'red')
    }

    const userCards = await getUserCards(ctx, user)

    if (parsedargs.diff)
        cards = cards.filter(x => parsedargs.diff == 1 ^ userCards.some(y => y.cardid === x.id))

    const card = bestMatch(cards)
    if(!user.wishlist.some(x => x === card.id)) {
        return ctx.reply(user, `you don't have ${formatName(card)} in your wishlist`, 'red')
    }

    let stats = await getStats(ctx, user, user.lastdaily)
    stats.wish--
    user.wishlist = user.wishlist.filter(x => x != card.id)
    await user.save()
    await stats.save()

    return ctx.reply(user, `removed ${formatName(card)} from your wishlist`)
}))).access('dm')

cmd(['wish', 'remove', 'many'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs) => {
    cards = cards.filter(x => user.wishlist.some(y => y === x.id))

    if(user.wishlist.length === 0) {
        return ctx.reply(user, `your wishlist is empty. Use \`${ctx.prefix}wish add [card]\` to add cards to your wishlist`, 'red')
    }

    const userCards = await getUserCards(ctx, user)

    if (parsedargs.diff)
        cards = cards.filter(x => parsedargs.diff == 1 ^ userCards.some(y => y.cardid === x.id))

    if(cards.length === 0)
        return ctx.reply(user, `none of the requested cards are in your wishlist`, 'red')

    return ctx.sendCfm(ctx, user, {
        force: ctx.globals.force,
        question: `**${user.username}**, do you want remove **${numFmt(cards.length)}** cards from your wishlist?`,
        onConfirm: async (_x) => {
            let stats = await getStats(ctx, user, user.lastdaily)
            user.wishlist = user.wishlist.filter(y => !cards.some(c => c.id === y))
            stats.wish -= cards.length
            await user.save()
            await stats.save()

            return ctx.reply(user, `removed **${numFmt(cards.length)}** cards from your wishlist`)
        }
    })
}))).access('dm')
