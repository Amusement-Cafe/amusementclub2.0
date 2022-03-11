const User      = require('../collections/user')
const UserCard  = require('../collections/userCard')
const Cardinfo  = require('../collections/cardinfo')
const asdate    = require('add-subtract-date')
const _         = require('lodash')
const cardMod   = require('./card');
const colors    = require('../utils/colors')

const {
    numFmt
} = require('../utils/tools')
const {
    fetchInfo,
} = require('./meta')

const userCountTTL = 360000
const queueTick = 200
const evalLastDaily = asdate.subtract(new Date(), 6, 'months');
const evalQueue = []

let userCount, userCountUpdated, evalPromise

const evalCard = async (ctx, card, modifier = 1) => {
    if((!userCount && Date.now() - userCountUpdated > userCountTTL) || !userCountUpdated) {
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
    // TODO consider only active users
    const ownercount = count || (await UserCard.countDocuments({ cardid: card.id }))

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

    if(cardeval <= 0)
        return Infinity

    let diff = cardeval / (ctx.eval.cardPrices.slice().reverse()[card.level] * ctx.eval.evalVialRate)
    if(diff === Infinity) 
        diff = 0

    return Math.round(10 + diff)
}

const checkQueue = async (ctx) => {
    if (!userCount)
        userCount = await User.countDocuments({ lastdaily: { $gt: evalLastDaily }})

    const card = evalQueue[0]
    if(card && (!evalPromise || !evalPromise.pending)) {
        evalQueue.shift()
        evalPromise = updateCardUserCount(ctx, card)
        await evalPromise

        console.log(`${card.id} (${evalQueue.length} left)`)
    }
}

const getEval = (ctx, card, ownerCount, modifier = 1) => {
    const allUsers = userCount || ownerCount * 2
    const info = fetchInfo(ctx, card.id)

    let price =  Math.round(((ctx.eval.cardPrices[card.level] + (card.animated? 100 : 0))
        * limitPriceGrowth((allUsers * ctx.eval.evalUserRate) / ownerCount)) * modifier)

    if (card.level === 5)
        price = legendaryBaseEval(ctx, card)

    if (info.aucevalinfo.evalprices.length >= ctx.eval.aucEval.minSamples) {

        let priceFloor = Math.round((((ctx.eval.cardPrices[card.level] + (card.animated? 100 : 0))
            * limitPriceGrowth((allUsers * ctx.eval.evalUserRate) / ownerCount)) * 0.3579) * modifier)

        price = Math.round((info.aucevalinfo.evalprices.reduce((a, b) => a + b) / info.aucevalinfo.evalprices.length) * modifier)

        if (price < priceFloor)
            price = priceFloor
    }

    return price === Infinity? 0 : price
}

const legendaryBaseEval = (ctx, card) => {
    const colCards = ctx.cards.filter(x => card.col === x.col && x.level !== 5)
    const division = colCards.length >= 200? colCards.length / 200: 1
    const stars = [
        colCards.filter(x => x.level === 4).map(y => evalCardFast(ctx, y)),
        colCards.filter(x => x.level === 3).map(y => evalCardFast(ctx, y)),
        colCards.filter(x => x.level === 2).map(y => evalCardFast(ctx, y)),
        colCards.filter(x => x.level === 1).map(y => evalCardFast(ctx, y))
    ]
    const sum = stars.map(x => x.length? x.reduce((a, b) => a + b) / division: 0).reduce((y, z) => y + z)
    return Math.round(sum * 0.4)
}

const evalAucOutlierCheck = (ctx, number, index, info) => {
    let othSum = 0
    info.aucevalinfo.newaucprices.map((b, i) => {
        if (i !== index)
            othSum += b
    })
    let othAvg = othSum / ((ctx.eval.aucEval.minSamples * 2) - 1)
    return _.inRange(number, othAvg * ctx.eval.aucEval.minBounds, othAvg * ctx.eval.aucEval.maxBounds)
}

const aucEvalChecks = async (ctx, auc, success = true) => {
    if (!success && auc.cancelled)
        return

    const info = fetchInfo(ctx, auc.card)
    const card = ctx.cards[auc.card]
    let eval = evalCardFast(ctx, card)

    if (!success && eval !== 0) {
        let float = parseFloat((auc.price * ctx.eval.aucEval.aucFailMultiplier).toFixed(2))

        if (auc.price > eval * 1.5)
            float = eval * ctx.eval.aucEval.aucFailMultiplier

        info.aucevalinfo.newaucprices.push(Math.floor(float))
    } else {
        info.aucevalinfo.newaucprices.push(auc.price)
    }

    let lastEval, evalDiff
    //increment the cards auction counter
    info.aucevalinfo.auccount += 1
    //if it doesn't have an eval in lasttold, set it
    info.aucevalinfo.lasttoldeval < 0? lastEval = eval: lastEval = info.aucevalinfo.lasttoldeval

    //If auction prices has filled up, shift it before moving on to the next steps
    if (info.aucevalinfo.newaucprices.length > ctx.eval.aucEval.maxSamples)
        info.aucevalinfo.newaucprices.shift()

    //If eval prices have filled up, shift it before moving on to the next steps
    if (info.aucevalinfo.evalprices.length > ctx.eval.aucEval.maxSamples)
        info.aucevalinfo.evalprices.shift()

    //If auction prices are at 2x min sample, or at max samples. Start this nonsense
    if (info.aucevalinfo.newaucprices.length >= ctx.eval.aucEval.minSamples * 2 || info.aucevalinfo.newaucprices.length === ctx.eval.aucEval.maxSamples) {
        //Filter out price outliers, to give a more natural/gentle price increase/decrease
        info.aucevalinfo.newaucprices = info.aucevalinfo.newaucprices.filter((a, b) => evalAucOutlierCheck(ctx, a, b, info))
        //Now that it's been filtered, check if the list is longer than minimum samples.
        //If it is, start this movement of waiting auc prices into eval prices. Auc prices will be cleared afterwards
        if (info.aucevalinfo.newaucprices.length >= ctx.eval.aucEval.minSamples) {
            info.aucevalinfo.newaucprices.map(x => {
                info.aucevalinfo.evalprices.push(x)
                if (info.aucevalinfo.evalprices.length > ctx.eval.aucEval.maxSamples)
                    info.aucevalinfo.evalprices.shift()
            })
            info.aucevalinfo.newaucprices = []
        }
    }

    if (info.aucevalinfo.auccount % (ctx.eval.aucEval.minSamples * 2) === 0){
        let newEval = await evalCard(ctx, card)
        let floored = newEval === Math.round((((ctx.eval.cardPrices[card.level] + (card.animated? 100 : 0))
            * limitPriceGrowth(((userCount || card.ownercount * 2) * ctx.eval.evalUserRate) / card.ownercount)) * 0.3579))
        if (lastEval === newEval)
            return await info.save()

        if (lastEval > newEval)
            evalDiff = `-${lastEval - newEval}`
        else
            evalDiff = `+${newEval - lastEval}`

        let evalPrices = info.aucevalinfo.evalprices.length > 0? info.aucevalinfo.evalprices.join(', '): 'empty'
        let aucPrices = info.aucevalinfo.newaucprices.length > 0? info.aucevalinfo.newaucprices.join(', '): 'empty'

        let pricesEmbed = {
            author: { name: `New Eval for card ${card.name}, ID: ${card.id}` },
            fields: [
                {
                    name: "Card Link",
                    value: `${cardMod.formatName(card)}`,
                    inline: true
                },
                {
                    name: "Currently Used Eval Prices List",
                    value: `${evalPrices}`
                },
                {
                    name: "Current Auc Prices List",
                    value: `${aucPrices}`
                },
                {
                    name: "Old Eval",
                    value: `${numFmt(lastEval)}`,
                    inline: true
                },
                {
                    name: "New Eval",
                    value: `${numFmt(newEval)} ${floored? '\n**AT EVAL FLOOR**': ''}`,
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

        info.aucevalinfo.lasttoldeval = newEval

        if (ctx.eval.aucEval.evalUpdateChannel)
            await ctx.bot.createMessage(ctx.eval.aucEval.evalUpdateChannel, {embed: pricesEmbed})
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
