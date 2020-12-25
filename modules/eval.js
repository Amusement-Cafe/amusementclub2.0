const User      = require('../collections/user')
const Cardinfo  = require('../collections/cardinfo')
const asdate    = require('add-subtract-date')

const userCountTTL = 5000
const queueTick = 500
const cardPrices = [ 30, 80, 150, 400, 1000, 2500 ]
const evalUserRate = 0.25
const evalVialRate = 0.055
const evalLastDaily = asdate.subtract(new Date(), 6, 'months');
const evalQueue = []

let userCount = 10, userCountUpdated

const evalCard = async (ctx, card, modifier = 1) => {
    if(!userCount && Date.now() - userCountUpdated > userCountTTL) {
        userCount = await User.countDocuments({ lastdaily: { $gt: evalLastDaily }})
        userCountUpdated = Date.now()
    }
    
    const ownerCount = await updateCardUserCount(ctx, card)
    const price = getEval(card, ownerCount, modifier)
    return price === Infinity? 0 : price
}

const evalCardFast = (card) => {
    let ownercount = Math.round(userCount * .5)
    if(card.ownercount)
        ownercount = card.ownercount
    else
        pushUserCountUpdate(card)

    return getEval(card, ownercount)
}

const updateCardUserCount = async (ctx, card, count) => {
    const ownercount = count || (await User.countDocuments({
        cards: { $elemMatch: { id: card.id }}, 
        lastdaily: { $gt: evalLastDaily }}))

    const info = await Cardinfo.findOne({id: card.id}) || new Cardinfo()
    const cachedCard = ctx.cards.find(x => x.id === card.id)
    info.id = card.id
    info.ownercount = ownercount
    cachedCard.ownercount = ownercount
    await info.save()

    return ownercount
}

const pushUserCountUpdate = (card) => {
    if(!evalQueue.includes(card))
        evalQueue.push(card)
}

const limitPriceGrowth = x => { 
    if(x<1) return x
    else if(x<10) return (Math.log(x)/1.3)+Math.sqrt(x)*(-0.013*Math.pow(x,2)+0.182*x+0.766)
    else return Math.pow(x, 0.2) + 4.25
}

const getVialCost = async (ctx, card, cardeval) => {
    if(!cardeval)
        cardeval = await evalCard(ctx, card)

    if(cardeval === 0)
        return Infinity

    let diff = cardeval / (cardPrices.slice().reverse()[card.level] * evalVialRate)
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

const getEval = (card, ownerCount, modifier = 1) => {
    const allUsers = userCount || ownerCount * 2
    return Math.round(((cardPrices[card.level] + (card.animated? 100 : 0))
        * limitPriceGrowth((allUsers * evalUserRate) / ownerCount)) * modifier)
}

const getQueueTime = () => evalQueue.length * queueTick

module.exports = {
    evalCard,
    evalCardFast,
    updateCardUserCount,
    pushUserCountUpdate,
    getVialCost,
    checkQueue,
    getQueueTime,
    queueTick,
}
