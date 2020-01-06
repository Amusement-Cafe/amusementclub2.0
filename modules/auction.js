const {cmd, pcmd}       = require('../utils/cmd')
const {Auction}         = require('../collections')
const {generateNextId}  = require('../utils/tools')
const {fetchOnly}       = require('./user')

const {
    evalCard
} = require('../modules/eval')

const {
    formatName,
    removeUserCard
} = require('../modules/card')

const lockFile  = require('lockfile')
const asdate    = require('add-subtract-date')
const msToTime  = require('pretty-ms')

const new_auc = async (ctx, user, card, price, fee) => {
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
        auc.expires = asdate.add(new Date(), 1, 'hours')
        await auc.save()

        unlock()

        return ctx.reply(user, `you put ${formatName(card)} on auction for **${price}** {currency}`)
    })
}

const bid_auc = async (ctx, user, auc, bid) => {
    const lastBidder = await fetchOnly(auc.lastbidder)
    const diff = auc.expires - new Date()
    if(diff < 300000)
        auc.expires = asdate.add(auc.expires, 1, 'minutes')

    auc.bids.push({user: user.discord_id, bid: bid})
    
    if(bid < auc.highbid) {
        auc.price = bid
        await auc.save()
        return ctx.reply(user, `you were instantly outbid! Try bidding higher`, 'red')
    }

    auc.highbid = bid
    auc.lastbidder = user.discord_id
    await auc.save()

    if(lastBidder)
        ctx.direct(lastBidder, `Another player has outbid you on card ${formatName(ctx.cards[auc.card])}
            To remain in the auction, try bidding higher than ${auc.price} {currency}
            Use \`->auc bid ${auc.id} [new bid]\`
            This auction will end in **${msToTime(diff)}**`)

    return ctx.reply(user, `you successfully bid on auction \`${auc.id}\` with **${bid}** {currency}!`)
}

const finish_auc = async (ctx, auc) => {
    auc.finished = true
    await auc.save()

    const lastBidder = await fetchOnly(auc.lastbidder)
    const author = await fetchOnly(auc.author)

    //ctx.direct
}

const paginate_auclist = (ctx, user, list) => {
    const pages = []
    list.map((t, i) => {
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

const tick = async () => {
    const now = new Date()
    const lastAuc = (await Auction.find().sort({ expires: -1 }))[0]
    if(lastAuc && lastAuc.expires < now) {
        await finish_auc(lastAuc)
    }
}

//setInterval(tick.bind(this), 2500);

module.exports = {
    new_auc,
    paginate_auclist,
    bid_auc
}