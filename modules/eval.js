const User      = require('../collections/user')
const Cardinfo  = require('../collections/cardinfo')
const asdate    = require('add-subtract-date')
const cardMod   = require("./card");
const colors    = require('../utils/colors')

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
    const info = fetchInfo(ctx, card.id)


    let priceFloor = (ctx.eval.cardPrices[card.level] + (card.animated? 100 : 0)) / 2

    if (info.aucprices.length < ctx.eval.aucEval.minSamples) {
        return Math.round(((ctx.eval.cardPrices[card.level] + (card.animated? 100 : 0))
            * limitPriceGrowth((allUsers * ctx.eval.evalUserRate) / ownerCount)) * modifier)
    } else {
        let evalCalc = ((info.aucprices.reduce((a, b) => a + b) / info.aucprices.length)) / 2
        if (evalCalc < priceFloor)
            evalCalc = priceFloor
        return Math.round((evalCalc
            * limitPriceGrowth((allUsers * ctx.eval.evalUserRate) / ownerCount)) * modifier)
    }


}

const aucEvalChecks = async (ctx, card_id, aucPrice, success = true) => {
    const info = fetchInfo(ctx, card_id)
    const card = ctx.cards[card_id]
    let eval = evalCardFast(ctx, card)
    let lastEval, evalDiff
    info.lasttoldeval < 0? lastEval = eval: lastEval = info.lasttoldeval
    info.auccount += 1
    if (!success && eval !== 0) {
        let float = parseFloat((eval * ctx.eval.aucEval.aucFailMultiplier).toFixed(2))
        info.aucprices.push(float)
    } else {
        const withinBounds = aucPrice > (eval * ctx.eval.aucEval.minBounds) && aucPrice < (eval * ctx.eval.aucEval.maxBounds)
        if (withinBounds)
            info.aucprices.push(aucPrice)
    }
    if (info.aucprices.length > ctx.eval.aucEval.maxSamples)
        info.aucprices.shift()

    if (info.auccount % 5 === 0) {
        let newEval = await evalCard(ctx, card)
        if (lastEval > newEval)
            evalDiff = `-${lastEval - newEval}`
        else
            evalDiff = `+${newEval - lastEval}`
        let pricesEmbed = {
            author: { name: `New Eval for card ${card.name}, ID: ${card.id}` },
            fields: [
                {
                    name: "Card Link",
                    value: `${cardMod.formatName(card)}`,
                    inline: true
                },
                {
                    name: "Current Prices List",
                    value: `${info.aucprices.join(', ')}`
                },
                {
                    name: "Old Eval",
                    value: `${lastEval}`,
                    inline: true
                },
                {
                    name: "New Eval",
                    value: `${newEval}`,
                    inline: true
                },
                {
                    name: "Eval Diff",
                    value: evalDiff,
                    inline: true
                }

            ],
            color: colors.green
        }
        info.lasttoldeval = newEval
        if (ctx.eval.aucEval.evalUpdateChannel)
            await ctx.send(ctx.eval.aucEval.evalUpdateChannel, pricesEmbed)
    }

    await info.save()
}

const getQueueTime = () => evalQueue.length * queueTick

module.exports = {
    aucEvalChecks,
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
