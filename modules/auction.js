const lockFile  = require('proper-lockfile')
const asdate    = require('add-subtract-date')
const msToTime  = require('pretty-ms')
const _         = require("lodash")

const {
    Auction,
    AuditAucSell,
} = require('../collections')

const {
    generateNextId,
    numFmt,
} = require('../utils/tools')

const {
    completed,
} = require('../modules/collection')

const {
    check_effect,
} = require('../modules/effect')

const {
    eval_fraud_check,
    audit_auc_stats,
} = require('./audit')

const {
    formatName,
} = require('./card')

const {
    aucEvalChecks,
    evalCard,
} = require('./eval')

const {
    fetchOnly, 
    addUserCards,
    removeUserCards,
    findUserCards,
    getUserCards,
} = require('./user')

const {
    from_auc,
} = require('./transaction')

const {
    plotPayout,
} = require('./plot')

const {
    getStats,
    saveAndCheck,
} = require("./userstats");

const new_auc = (ctx, user, card, price, fee, time) => new Promise(async (resolve, reject) => {
    const target = await fetchOnly(user.discord_id)
    const targetCard = await findUserCards(ctx, target, [card.id])
    if(!targetCard)
        return reject('no cards found')

    lockFile.lock('auc', {retries: 10}).then(async (release) => {
        await Promise.all([
            removeUserCards(ctx, target, [card.id]),
            completed(ctx, target, [card.id]),
            target.updateOne({$inc: {exp: -fee, 'dailystats.aucs': 1}}),
        ])

        const last_auc = (await Auction.find().sort({ _id: -1 }))[0]
        const auc = await new Auction()
        auc.id = last_auc? generateNextId(last_auc.id, 4) : generateNextId('aaaa', 4)
        auc.price = price
        auc.highbid = price
        auc.author = user.discord_id
        auc.card = card.id
        auc.expires = asdate.add(new Date(), time, 'hours')
        auc.time = new Date()
        auc.guild = ctx.guild.id
        await auc.save()
        await lockFile.unlock('auc')
        return resolve(auc)
    }).catch(async (e) => {
        await lockFile.unlock('auc')
        return reject(e)
    })
})

const bid_auc = async (ctx, user, auc, bid, add = false) => {
    const lastBidder = await fetchOnly(auc.lastbidder)
    let diff = auc.expires - new Date()

    auc.bids.push({user: user.discord_id, bid: bid, time: new Date()})
    let bidsLeft = 5, cur = auc.bids.length - 1
    while(cur >= 0 && auc.bids[cur].user === user.discord_id) {
        cur--
        bidsLeft--
    }

    if(bidsLeft < 0)
        return ctx.reply(user, `you have exceeded the amount of bid attempts for this auction`, 'red')
    
    if(bid <= auc.highbid) {
        auc.price = bid
        await auc.save()
        return ctx.reply(user, `you were instantly outbid! Try bidding higher
            You have **${bidsLeft}** bid attempts left`, 'red')
    }

    if(diff < 300000) {
        auc.expires = asdate.add(auc.expires, 3, 'minutes')
        diff = auc.expires - new Date()
        auc.markModified('expires')
    }

    if (!add) {
        auc.price = auc.highbid
        auc.lastbidder = user.discord_id
    }


    if (add)
        user.exp -= bid - auc.highbid
    else
        user.exp -= bid

    auc.highbid = bid

    await user.save()
    await auc.save()

    let stats = await getStats(ctx, user, user.lastdaily)
    stats.aucbid += 1
    await saveAndCheck(ctx, user, stats)

    const author = await fetchOnly(auc.author)

    if(lastBidder && !add){
        lastBidder.exp += auc.price
        await lastBidder.save()

        const { aucoutbid } = lastBidder.prefs.notifications
        if(aucoutbid && lastBidder.discord_id != user.discord_id) {
            try {
                await ctx.direct(lastBidder, `Another player has outbid you on card ${formatName(ctx.cards[auc.card])}
                To remain in the auction, try bidding higher than ${numFmt(auc.price)} ${ctx.symbols.tomato}
                Use \`/auction bid auction_id:${auc.id}\`
                This auction will end in **${formatAucTime(auc.expires)}**`, 'yellow')
            } catch (e) {}

        }

        const { aucnewbid } = author.prefs.notifications
        if(aucnewbid) {
            try {
                await ctx.direct(author, `your auction \`${auc.id}\` for card 
                ${formatName(ctx.cards[auc.card])} got a new bid. New listed price: **${numFmt(auc.price)} ${ctx.symbols.tomato}**.`, 'blue')
            } catch (e) {}
        }
    } else if (!add) {
        const { aucbidme } = author.prefs.notifications
        if(aucbidme) {
            try {
                await ctx.direct(author, `a player has bid on your auction \`${auc.id}\` for card 
                ${formatName(ctx.cards[auc.card])} with minimum ${numFmt(auc.price)} ${ctx.symbols.tomato}!`, 'green')
            } catch (e) {}
        }
    }

    if (add)
        return ctx.reply(user, `you successfully increased your bid on auction \`${auc.id}\` to **${numFmt(bid)}** ${ctx.symbols.tomato}!
                                You can add to your bid **${bidsLeft}** more times!`)
    else
        await plotPayout(ctx, 'auchouse', 1, 50)

    return ctx.reply(user, `you successfully bid on auction \`${auc.id}\` with **${numFmt(bid)}** ${ctx.symbols.tomato}!`)
}

const finish_aucs = async (ctx, now) => {
    const auc = (await Auction.find({ finished: false }).sort({ expires: 1 }))[0]
    if(!auc || auc.expires > now) return;

    auc.finished = true
    await auc.save()

    const lastBidder = await fetchOnly(auc.lastbidder)
    const author = await fetchOnly(auc.author)
    const findSell = await AuditAucSell.findOne({ user: author.discord_id})

    if(lastBidder) {
        let authorStats = await getStats(ctx, author, author.lastdaily)
        let winnerStats = await getStats(ctx, lastBidder, lastBidder.lastdaily)
        const tback = await check_effect(ctx, lastBidder, 'skyfriend')? Math.round(auc.price * .1) : 0
        lastBidder.exp += (auc.highbid - auc.price) + tback
        winnerStats.tomatoout += (auc.highbid - auc.price) + tback
        winnerStats.aucwin += 1

        author.exp += auc.price
        authorStats.tomatoin += auc.price
        await authorStats.save()
        await winnerStats.save()

        await Promise.all([
            addUserCards(ctx, lastBidder, [auc.card]),
            author.save(),
            lastBidder.save(),
        ])

        if(author.prefs.notifications.aucend) {
            try {
                await ctx.direct(author, `you sold ${formatName(ctx.cards[auc.card])} on auction \`${auc.id}\` for **${numFmt(auc.price)}** ${ctx.symbols.tomato}`)
            } catch (e) {}
        }

        try {
            await ctx.direct(lastBidder, `you won auction \`${auc.id}\` for card ${formatName(ctx.cards[auc.card])}!
            You ended up paying **${numFmt(Math.round(auc.price))}** ${ctx.symbols.tomato} and got **${numFmt(Math.round(auc.highbid - auc.price))}** ${ctx.symbols.tomato} back.
            ${tback > 0? `You got additional **${numFmt(tback)}** ${ctx.symbols.tomato} from your equipped effect` : ''}`)
        } catch (e) {}

        const aucCard = ctx.cards[auc.card]
        const eval = await evalCard(ctx, aucCard)
        await eval_fraud_check(ctx, auc, eval, aucCard)
        if(!findSell)
            await audit_auc_stats(ctx, author, true)
        else
            await AuditAucSell.findOneAndUpdate({ user: author.discord_id}, {$inc: {sold: 1}})

        await completed(ctx, lastBidder, [aucCard.id])
        await aucEvalChecks(ctx, auc)
        await from_auc(auc, author, lastBidder)
        await author.save()
        await lastBidder.save()

    } else {
        if(!findSell)
            await audit_auc_stats(ctx, author, false)
        else
            await AuditAucSell.findOneAndUpdate({ user: author.discord_id}, {$inc: {unsold: 1}})
        
        await Promise.all([
            addUserCards(ctx, author, [auc.card]),
            author.save(),
            aucEvalChecks(ctx, auc, false),
        ])
    
        if (author.prefs.notifications.aucend) {
            try {
                return ctx.direct(author, `your auction \`${auc.id}\` for card ${formatName(ctx.cards[auc.card])} finished, but nobody bid on it.
                You got your card back.`, 'yellow')
            } catch (e) {}
        }
    }
}

const paginate_auclist = (ctx, user, list) => {
    const pages = []
    list.map((auc, i) => {
        if (i % 10 == 0) 
            pages.push("")

        const msdiff = auc.expires - new Date()
        const timediff = msToTime(msdiff, {compact: true})
        const diffstr = formatAucTime(auc.expires, true)
        let char = ctx.symbols.auc_wss

        if(auc.author === user.discord_id) {
            if(auc.lastbidder) char = ctx.symbols.auc_lbd
            else char = ctx.symbols.auc_sbd
        } else if(auc.lastbidder === user.discord_id) {
            char = ctx.symbols.auc_sod
        }

        pages[Math.floor(i/10)] += `${char} [${diffstr}] \`${auc.id}\` [${numFmt(auc.price)}${ctx.symbols.tomato}] ${formatName(ctx.cards[auc.card])}\n`
    })

    return pages;
}

const format_auc = async(ctx, auc, author, doeval = true) => {
    const card = ctx.cards[auc.card]
    const msdiff = auc.expires - new Date()
    const timediff = formatAucTime(auc.expires)

    console.log(msdiff)

    const resp = []
    resp.push(`Seller: **${author.username}**`)
    resp.push(`Price: **${numFmt(auc.price)}** ${ctx.symbols.tomato}`)
    resp.push(`Card: ${formatName(card)}`)

    if(doeval)
        resp.push(`Card value: **${numFmt(await evalCard(ctx, card))}** ${ctx.symbols.tomato}`)

    if(auc.finished) {
        resp.push(`Winning bid: **${numFmt(auc.highbid)}**${ctx.symbols.tomato}`)
        resp.push(`**This auction has finished**`)
    } else {
        resp.push(`Expires in **${timediff}**`)
    }

    return resp.join('\n')
}

const formatAucTime = (time, compact = false) => {
    const timeToEndMS = time - new Date()

    if (timeToEndMS <= 0)
        return `0s`

    const hours = Math.floor((timeToEndMS / (1000 * 60)) / 60)
    const minutes = Math.floor((timeToEndMS / (1000 * 60)) % 60)

    if (hours === 0 && minutes <= 5)
        return `<5m`

    if (compact) {
        if (hours <= 0)
            return `~${minutes}m`
        if (minutes > 45)
            return `~${hours + 1}h`
        if (minutes < 15)
            return `~${hours}h`
        return `~${hours}.5h`
    }

    return `${hours <= 0? '': `${hours}h`} ${minutes}m`
}

const autoAuction = async (ctx) => {
    const active = await Auction.find({ finished: false })
    const aucUser = await fetchOnly(ctx.autoAuction.auctionUserID)

    if (active.length >= ctx.autoAuction.auctionCount || !aucUser)
        return

    const cards = await getUserCards(ctx, aucUser)
    const card = _.sample(cards)

    if (!card)
        return

    const aucCard = ctx.cards[card.cardid]
    const eval = await evalCard(ctx, aucCard)

    ctx.guild = {id: ctx.adminGuildID}

    await new_auc(ctx, aucUser, aucCard, Math.round(eval * ctx.autoAuction.auctionMultiplier), 0, ctx.autoAuction.auctionLength)
}

module.exports = {
    new_auc,
    paginate_auclist,
    bid_auc,
    finish_aucs,
    format_auc,
    autoAuction
}
