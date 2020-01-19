const {Auction}         = require('../collections')
const {generateNextId}  = require('../utils/tools')
const {fetchOnly}       = require('./user')

const {
    formatName,
    removeUserCard,
    addUserCard
} = require('../modules/card')

const lockFile  = require('lockfile')
const asdate    = require('add-subtract-date')
const msToTime  = require('pretty-ms')

const new_auc = async (ctx, user, card, price, fee, time) => {
    const target = await fetchOnly(user.discord_id)
    if(!target.cards.filter(x => x.id === card.id)[0])
        return ctx.reply(user, `seems like you don't have ${formatName(card)} card anymore`, 'red')

    lockFile.lock('auc.lock', { wait: 5000, stale: 10000 }, async err => {
        if(err)
            return ctx.reply(user, `failed to create auction. Please try again`, 'red')

        removeUserCard(target, card.id)
        target.exp -= fee
        await target.save()

        const last_auc = (await Auction.find().sort({ _id: -1 }))[0]
        const auc = await new Auction()
        auc.id = last_auc? generateNextId(last_auc.id, 4) : generateNextId('aaaa', 4)
        auc.price = price
        auc.highbid = price
        auc.author = user.discord_id
        auc.card = card.id
        auc.expires = asdate.add(new Date(), time, 'hours')
        await auc.save()

        unlock()

        return ctx.reply(user, `you put ${formatName(card)} on auction for **${price}** {currency}
            Auction ID: \`${auc.id}\``)
    })
}

const bid_auc = async (ctx, user, auc, bid) => {
    const lastBidder = await fetchOnly(auc.lastbidder)
    const diff = auc.expires - new Date()
    if(diff < 300000)
        auc.expires = asdate.add(auc.expires, 1, 'minutes')

    auc.bids.push({user: user.discord_id, bid: bid})
    
    if(bid <= auc.highbid) {
        auc.price = bid
        await auc.save()
        return ctx.reply(user, `you were instantly outbid! Try bidding higher`, 'red')
    }

    auc.price = auc.highbid
    auc.highbid = bid
    auc.lastbidder = user.discord_id
    await auc.save()

    if(lastBidder){
        lastBidder.exp += auc.price
        await lastBidder.save()
        await ctx.direct(lastBidder, `Another player has outbid you on card ${formatName(ctx.cards[auc.card])}
            To remain in the auction, try bidding higher than ${auc.price} {currency}
            Use \`->auc bid ${auc.id} [new bid]\`
            This auction will end in **${msToTime(diff)}**`, 'yellow')
    }

    user.exp -= bid
    await user.save()
    return ctx.reply(user, `you successfully bid on auction \`${auc.id}\` with **${bid}** {currency}!`)
}

const finish_aucs = async (ctx, now) => {
    const auc = (await Auction.find({ finished: false }).sort({ expires: -1 }))[0]
    if(!auc || auc.expires > now) return;

    auc.finished = true
    await auc.save()

    const lastBidder = await fetchOnly(auc.lastbidder)
    const author = await fetchOnly(auc.author)

    if(lastBidder) {
        lastBidder.exp += auc.highbid - auc.price
        author.exp += auc.price
        addUserCard(lastBidder, auc.card)
        await lastBidder.save()
        await author.save()

        await ctx.direct(author, `your sold ${formatName(ctx.cards[auc.card])} on auction \`${auc.id}\` for **${auc.price}** {currency}`)
        return ctx.direct(lastBidder, `your won auction \`${auc.id}\` for card ${formatName(ctx.cards[auc.card])}!`)
    } else {
        addUserCard(author, auc.card)
        await author.save()
        return ctx.direct(author, `your auction \`${auc.id}\` for card ${formatName(ctx.cards[auc.card])} finished, but nobody bid on it.
            You got your card back.`, 'yellow')
    }
}

const paginate_auclist = (ctx, user, list) => {
    const pages = []
    list.map((auc, i) => {
        if (i % 10 == 0) 
            pages.push("")

        const timediff = msToTime(auc.expires - new Date(), {compact: true})
        pages[Math.floor(i/10)] += `[${timediff}] \`${auc.id}\` [${auc.price}{currency}] ${formatName(ctx.cards[auc.card])}\n`
    })

    return pages;
}

const unlock = () => {
    lockFile.unlock('auc.lock', err => {
        console.log(err)
    })
}

module.exports = {
    new_auc,
    paginate_auclist,
    bid_auc,
    finish_aucs
}