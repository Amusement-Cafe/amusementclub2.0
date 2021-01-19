const {Auction, AuditAucSell}         = require('../collections')
const {evalCard}                      = require("../modules/eval");
const {generateNextId}                = require('../utils/tools')
const {fetchOnly}                     = require('./user')

const {
    completed
} = require('../modules/collection')

const {
    check_effect
} = require('../modules/effect')

const {
    eval_fraud_check,
    audit_auc_stats
} = require('./audit')

const {
    formatName,
    removeUserCard,
    addUserCard
} = require('./card')

const {
    aucEvalChecks
} = require("./eval");

const {
    from_auc
} = require('./transaction')


const lockFile  = require('lockfile')
const asdate    = require('add-subtract-date')
const msToTime  = require('pretty-ms')


const aucHide   = 5 * 60 * 1000

const new_auc = (ctx, user, card, price, fee, time) => new Promise(async (resolve, reject) => {
    const target = await fetchOnly(user.discord_id)
    if(!target.cards.find(x => x.id === card.id))
        return reject('no cards found')

    lockFile.lock('auc.lock', { wait: 5000, stale: 10000 }, async err => {
        if(err)
            return reject(err)

        removeUserCard(ctx, target, card.id)
        
        await target.updateOne({$inc: {exp: -fee, 'dailystats.aucs': 1}})
        await target.save()

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

        unlock()

        return resolve(auc)
    })
})

const bid_auc = async (ctx, user, auc, bid) => {
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

    auc.price = auc.highbid
    auc.highbid = bid
    auc.lastbidder = user.discord_id

    user.exp -= bid
    user.dailystats.bids = user.dailystats.bids + 1 || 1
    user.markModified('dailystats')
    await user.save()
    await auc.save()

    if(lastBidder){
        lastBidder.exp += auc.price
        await lastBidder.save()

        if(lastBidder.discord_id != user.discord_id) {
            await ctx.direct(lastBidder, `Another player has outbid you on card ${formatName(ctx.cards[auc.card])}
                To remain in the auction, try bidding higher than ${auc.price} ${ctx.symbols.tomato}
                Use \`->auc bid ${auc.id} [new bid]\`
                This auction will end in **${diff > 60000? msToTime(diff) : '<1m'}**`, 'yellow')
        }
    } else {
        const author = await fetchOnly(auc.author)
        await ctx.direct(author, `a player has bid on your auction \`${auc.id}\` for card 
            ${formatName(ctx.cards[auc.card])} with minimum ${auc.price} ${ctx.symbols.tomato}!`, 'green')
    }

    return ctx.reply(user, `you successfully bid on auction \`${auc.id}\` with **${bid}** ${ctx.symbols.tomato}!`)
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
        const tback = check_effect(ctx, lastBidder, 'skyfriend')? Math.round(auc.price * .1) : 0
        lastBidder.exp += (auc.highbid - auc.price) + tback
        author.exp += auc.price
        addUserCard(lastBidder, auc.card)
        //Audit Logic Start
        const aucCard = ctx.cards[auc.card]
        const eval = await evalCard(ctx, aucCard)
        await eval_fraud_check(ctx, auc, eval, aucCard)
        if(!findSell){
            await audit_auc_stats(ctx, author, true)
        }else {
            await AuditAucSell.findOneAndUpdate({ user: author.discord_id}, {$inc: {sold: 1}})
        }
        // End audit logic
        await completed(ctx, lastBidder, aucCard)
        await lastBidder.save()
        await author.save()
        await from_auc(auc, author, lastBidder)
        await aucEvalChecks(ctx, auc.card, auc.price)

        await ctx.direct(author, `you sold ${formatName(ctx.cards[auc.card])} on auction \`${auc.id}\` for **${auc.price}** ${ctx.symbols.tomato}`)
        return ctx.direct(lastBidder, `you won auction \`${auc.id}\` for card ${formatName(ctx.cards[auc.card])}!
            You ended up paying **${Math.round(auc.price)}** ${ctx.symbols.tomato} and got **${Math.round(auc.highbid - auc.price)}** ${ctx.symbols.tomato} back.
            ${tback > 0? `You got additional **${tback}** ${ctx.symbols.tomato} from your equipped effect` : ''}`)
    } else {
        if(!findSell){
            await audit_auc_stats(ctx, author, false)
        }else {
            await AuditAucSell.findOneAndUpdate({ user: author.discord_id}, {$inc: {unsold: 1}})
        }
        addUserCard(author, auc.card)
        await author.save()
        await aucEvalChecks(ctx, auc.card, auc.price, false)
        return ctx.direct(author, `your auction \`${auc.id}\` for card ${formatName(ctx.cards[auc.card])} finished, but nobody bid on it.
            You got your card back.`, 'yellow')
    }
}

const paginate_auclist = (ctx, user, list) => {
    const pages = []
    list.map((auc, i) => {
        if (i % 10 == 0) 
            pages.push("")

        const msdiff = auc.expires - new Date()
        const timediff = msToTime(msdiff, {compact: true})
        const diffstr = msdiff > aucHide? timediff : '<5m'
        let char = ctx.symbols.auc_wss

        if(auc.author === user.discord_id) {
            if(auc.lastbidder) char = ctx.symbols.auc_lbd
            else char = ctx.symbols.auc_sbd
        } else if(auc.lastbidder === user.discord_id) {
            char = ctx.symbols.auc_sod
        }

        pages[Math.floor(i/10)] += `${char} [${diffstr}] \`${auc.id}\` [${auc.price}${ctx.symbols.tomato}] ${formatName(ctx.cards[auc.card])}\n`
    })

    return pages;
}

const format_auc = async(ctx, auc, author, doeval = true) => {
    const card = ctx.cards[auc.card]
    const msdiff = auc.expires - new Date()
    const timediff = msToTime(msdiff)

    console.log(msdiff)

    const resp = []
    resp.push(`Seller: **${author.username}**`)
    resp.push(`Price: **${auc.price}** ${ctx.symbols.tomato}`)
    resp.push(`Card: ${formatName(card)}`)

    if(doeval)
        resp.push(`Card value: **${await evalCard(ctx, card)}** ${ctx.symbols.tomato}`)

    if(auc.finished) {
        resp.push(`Winning bid: **${auc.highbid}**${ctx.symbols.tomato}`)
        resp.push(`**This auction has finished**`)
    } else {
        resp.push(`Expires in **${msdiff > aucHide? timediff : '<5m'}**`)
    }

    return resp.join('\n')
}

const unlock = () => {
    lockFile.unlock('auc.lock', err => {
        if(err) console.log(err)
    })
}

module.exports = {
    new_auc,
    paginate_auclist,
    bid_auc,
    finish_aucs,
    format_auc
}
