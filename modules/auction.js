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

const lockFile = require('lockfile')
const asdate = require('add-subtract-date')
const msToTime = require('pretty-ms')

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
        auc.id = getNewID(last_auc)
        auc.price = price
        auc.author = user.discord_id
        auc.card = card.id
        auc.expires = asdate.add(new Date(), 1, 'hours')
        await auc.save()

        unlock()

        return ctx.reply(user, `you put ${formatName(card)} on auction for **${price}** {currency}`)
    })
}

const finish_auc = async (auc) => {

}

const paginate_auclist = (ctx, user, list) => {
    const pages = []
    list.map((t, i) => {
        if (i % 10 == 0) pages.push("")
        pages[Math.floor(i/10)] += `${format_listauc(ctx, user, t)}\n`
    })

    return pages;
}

const format_listauc = (ctx, user, trans) => {
    let resp = ""
    const timediff = msToTime(new Date() - trans.time, {compact: true})
    const isget = trans.from_id != user.discord_id

    resp += `[${timediff}] ${ch_map[trans.status]} \`${trans.id}\` ${formatName(ctx.cards[trans.card])}`
    resp += isget ? ` \`<-\` **${trans.from}**` : ` \`->\` **${trans.to}**`;
    return resp;
}

const unlock = () => {
    lockFile.unlock('auc.lock', err => {
        console.log(err)
    })
}

const getNewID = (last_auc) => {
    if(!last_auc)
        return generateNextId('aaaa', 4)
    return generateNextId(last_auc.id, 4)
}

const tick = async () => {
    const now = new Date()
    const lastAuc = (await Auction.find().sort({ expires: -1 }))[0]
    if(lastAuc < now) {
        await finish_auc(lastAuc)
    }
}

setInterval(tick.bind(this), 2500);

module.exports = {
    new_auc,
    paginate_auclist
}