const {Card, Collection}    = require('../collections')
const {cap, claimCost}      = require('../utils/tools')
const colMod                = require('../modules/collection')
const {cmd}                 = require('../utils/cmd')

const {
    fetchRandom,
    formatClaim,
    formatName,
    formatLink,
    userHasCard,
    equals,
    getUserCard,
    addUserCard,
    cardIndex
} = require('../modules/card')

cmd('claim', 'cl', async (ctx, user, arg1) => {
    const countCol = await Collection.countDocuments()
    const items = []
    const amount = parseInt(arg1) || 1
    const price = claimCost(user, amount)


    if(price > user.exp)
        return ctx.reply(user, `you need ${price} {curency} to claim ${amount > 1? amount + ' cards' : 'a card'}.\n 
            You have ${Math.floor(user.exp)}`)

    for (let i = 0; i < amount; i++) {
        const q = { col: (await colMod.fetchRandom(countCol)).id, level: { $lt: 4 } }
        const countCard = await Card.countDocuments(q)
        const item = await fetchRandom(countCard, q)
        addUserCard(user, item)
        items.push(item)
    }

    user.exp -= price
    user.dailystats.claims = user.dailystats.claims + amount || amount

    await user.save()
    return ctx.reply(user, formatClaim(user, items))
})

cmd(['claim', 'promo'], async (ctx, user, arg1) => {
    const items = await fetchRandom({ isPromo: true }, parseInt(arg1) || 1)

    return ctx.reply(user, items.join('\n'))
})

cmd('sum', 'summon', async (ctx, user, ...args) => {
    let card = {}
    if(args.length == 0)
        card = user.cards[0]
    else card = await getUserCard(user, args)

    if(!card || card === 0)
        return ctx.reply(user, `card **${args.join(' ')}** doesn't exist`)

    if(parseInt(card))
        return ctx.reply(user, `got **${parseInt(card)}** results. You have none of those cards`)

    return ctx.reply(user, {
        url: formatLink(card),
        description: `summons **${formatName(card)}**!`
    })
});

cmd('sell', async (ctx, user, ...args) => {
    const card = await getUserCard(user, args)

    if(!card || card === 0)
        return ctx.reply(user, `card **${args.join(' ')}** doesn't exist`)

    if(parseInt(card))
        return ctx.reply(user, `got **${parseInt(card)}** results. You have none of those cards`)

    if(card.amount > 1)
        user.cards[cardIndex(user, card)].amount--
    else
        user.cards = user.cards.filter(x => !equals(x, card))

    await user.save()
    return ctx.reply(user, `you sold **${formatName(card)}** for `)
})
