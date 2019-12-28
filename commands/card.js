const {claimCost}           = require('../utils/tools')
const {cmd}                 = require('../utils/cmd')
const {addConfirmation}     = require('../utils/confirmator')
const sample                = require('lodash.sample');

const {
    new_trs,
    confirm_trs,
    decline_trs,
    check_trs
} = require('../modules/transaction')

const {
    formatName,
    formatLink,
    equals,
    addUserCard,
    withCards,
    bestMatch
} = require('../modules/card')

cmd('claim', 'cl', async (ctx, user, arg1) => {
    const cards = []
    const amount = parseInt(arg1) || 1
    const price = claimCost(user, amount)

    if(price > user.exp)
        return ctx.reply(user, `you need **${price}** {curency} to claim ${amount > 1? amount + ' cards' : 'a card'}.\n 
            You have ${Math.floor(user.exp)}`)

    for (let i = 0; i < amount; i++) {
        const col = sample(ctx.collections)
        const item = sample(ctx.cards.filter(x => x.col === col.id && x.level < 5))
        addUserCard(user, item.id)
        cards.push(item)
    }

    user.exp -= price
    user.dailystats.claims = user.dailystats.claims + amount || amount
    user.markModified('dailystats')

    await user.save()

    cards.sort((a, b) => b.level - a.level)

    return ctx.reply(user, {
        url: formatLink(cards[0]),
        description: `you got:\n ${cards.map(x => formatName(x)).join('\n')}\n\nYour next claim will cost **${claimCost(user, 1)}** {currency}`
    })
})

cmd('sum', 'summon', withCards(async (ctx, user, cards, parsedargs) => {
    const card = bestMatch(cards)
    return ctx.reply(user, {
        url: formatLink(card),
        description: `summons **${formatName(card)}**!`
    })
}))

cmd('sell', withCards(async (ctx, user, cards, parsedargs) => {
    const pending = await check_trs(ctx, user, parsedargs.id)
    if(pending)
        return ctx.reply(user, `you already have pending unconfirmed transaction to **${pending.to}**. 
            You must resolve that transaction before setting up a new one`, 'red')

    if(!ctx.msg.channel.guild)
        return ctx.reply(user, `transactions are possible only in guild channel`, 'red')

    const prm = { confirm: [parsedargs.id], decline: [user.discord_id, parsedargs.id] }
    const price = 100
    const card = bestMatch(cards)
    const trs = await new_trs(ctx, user, card, parsedargs.id)
    const footer = `ID: \`${trs.id}\``

    let question = `**${trs.from}**, do you want to sell **${formatName(card)}** to **bot** for **${price}** {currency}?`

    if(parsedargs.id) {
        question = `**${trs.to}**, **${trs.from}** wants to sell you **${formatName(card)}** for **${price}** {currency}`
    } else {
        prm.confirm.push(user.discord_id)
    }

    addConfirmation(ctx, user, question, prm, 
        async (x) => {
            await confirm_trs(ctx, x, trs.id)
        }, async (x) => {
            await decline_trs(ctx, x, trs.id)
        }, footer)
}))
