const User      = require('../collections/user')
const Cardinfo  = require('../collections/cardinfo')
const asdate    = require('add-subtract-date')

const {
    fetchInfo,
} = require('./meta')

const userCountTTL = 360000
const queueTick = 500
const evalLastDaily = asdate.subtract(new Date(), 6, 'months');
const evalQueue = []

let userCount = 10, userCountUpdated

const evalCard = async (ctx, card, modifier = 1) => {
    if(!userCount && Date.now() - userCountUpdated > userCountTTL) {
        userCount = await User.countDocuments({ lastdaily: { $gt: evalLastDaily }})
        userCountUpdated = Date.now()
    }
    
    const ownerCount = await updateCardUserCount(ctx, card)
    const price = getEval(ctx, card, ownerCount, modifier)
    return price === Infinity? 0 : price
}

const evalCardFast = (ctx, card) => {
    const info = fetchInfo(ctx, card.id)
    if(info.ownercount > -1) {
        return getEval(ctx, card, info.ownercount)
    }

    pushUserCountUpdate(card)
    return -1
}

const updateCardUserCount = async (ctx, card, count) => {
    const ownercount = count || (await User.countDocuments({
        cards: { $elemMatch: { id: card.id }}, 
        lastdaily: { $gt: evalLastDaily }}))

    const info = fetchInfo(ctx, card.id)
    const cachedCard = ctx.cards.find(x => x.id === card.id)
    info.id = card.id
    info.ownercount = ownercount
    cachedCard.ownercount = ownercount
    await info.save()

    return ownercount
}

const bulkIncrementUserCount = async (ctx, cardIds, inc = 1) => {
    const operations = cardIds.filter(x => ctx.cards[x].ownercount).map(x => {
        ctx.cards[x].ownercount += inc
        return {
            updateOne: {
                filter: { id: x },
                update: { $set: { ownercount: ctx.cards[x].ownercount }},
                upsert: false,
            }
        }
    })

    if(operations.length > 0) {
        await Cardinfo.bulkWrite(operations)
    }
}

const pushUserCountUpdate = (card) => {
    if(!evalQueue.some(x => x.id == card.id)) {
        evalQueue.push(card)
    }
}

const limitPriceGrowth = x => { 
    if(x<1) return x
    else if(x<10) return (Math.log(x)/1.3)+Math.sqrt(x)*(-0.013*Math.pow(x,2)+0.182*x+0.766)
    else return Math.pow(x, 0.2) + 4.25
}

const getVialCost = async (ctx, card, cardeval) => {
    if(!cardeval)
        cardeval = await evalCard(ctx, card)

    return getVialCostFast(ctx, card, cardeval)
}

const getVialCostFast = (ctx, card, cardeval) => {
    if(!cardeval)
        cardeval = evalCardFast(ctx, card)

    if(cardeval == -1)
        return -1

    if(cardeval === 0)
        return Infinity

    let diff = cardeval / (ctx.eval.cardPrices.slice().reverse()[card.level] * ctx.eval.evalVialRate)
    if(diff === Infinity) 
        diff = 0

    return Math.round(10 + diff)
}

const checkQueue = async (ctx) => {
    const card = evalQueue[0]
    if(card) {
        await updateCardUserCount(ctx, card)
        evalQueue.shift()
        console.log(card.id)
    }
}

const getEval = (ctx, card, ownerCount, modifier = 1) => {
    const allUsers = userCount || ownerCount * 2
    return Math.round(((ctx.eval.cardPrices[card.level] + (card.animated? 100 : 0))
        * limitPriceGrowth((allUsers * ctx.eval.evalUserRate) / ownerCount)) * modifier)

}

const getQueueTime = () => evalQueue.length * queueTick

module.exports = {
    evalCard,
    evalCardFast,
    updateCardUserCount,
    pushUserCountUpdate,
    getVialCost,
    checkQueue,
    bulkIncrementUserCount,
    getQueueTime,
    queueTick,
    getVialCostFast,
}
