const {claimCost}           = require('../utils/tools')
const {cmd}                 = require('../utils/cmd')
const {addConfirmation}     = require('../utils/confirmator')
const sample                = require('lodash.sample');
const {evalCard}            = require('../modules/eval')
const {addPagination}       = require('../utils/paginator')
const {bestColMatch}        = require('../modules/collection')
const {fetchCardTags}       = require('../modules/tag')
const colors                = require('../utils/colors')

const {
    new_trs,
    confirm_trs,
    decline_trs,
    check_trs
} = require('../modules/transaction')

const {
    formatName,
    formatLink,
    addUserCard,
    withCards,
    withGlobalCards,
    bestMatch,
} = require('../modules/card')

const {
    addGuildXP
} = require('../modules/guild')

cmd('claim', 'cl', async (ctx, user, arg1) => {
    const cards = []
    const amount = parseInt(arg1) || 1
    const price = claimCost(user, amount)

    if(amount > 10)
        return ctx.reply(user, `you can claim only **10** or less cards with one command`, 'red')

    if(price > user.exp)
        return ctx.reply(user, `you need **${price}** {currency} to claim ${amount > 1? amount + ' cards' : 'a card'}. 
            You have **${Math.floor(user.exp)}** {currency}`, 'red')

    for (let i = 0; i < amount; i++) {
        const col =  sample(ctx.collections.filter(x => !x.rarity))
        const item = sample(ctx.cards.filter(x => x.col === col.id && x.level < 5))
        addUserCard(user, item.id)
        cards.push(item)
    }

    user.exp -= price
    user.dailystats.claims = user.dailystats.claims + amount || amount
    user.markModified('dailystats')

    await user.save()

    cards.sort((a, b) => b.level - a.level)
    await addGuildXP(ctx, user, amount)

    return ctx.reply(user, {
        url: formatLink(cards[0]),
        description: `you got:\n ${cards.map(x => formatName(x)).join('\n')}\n\nYour next claim will cost **${claimCost(user, 1)}** {currency}`
    })
})

cmd('sum', 'summon', withCards(async (ctx, user, cards, parsedargs) => {
    const card = parsedargs.isEmpty()? sample(cards) : bestMatch(cards)
    return ctx.reply(user, {
        url: formatLink(card),
        description: `summons **${formatName(card)}**!`
    })
}))

cmd(['ls', 'global'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const pages = []

    cards.map((c, i) => {
        if (i % 15 == 0) pages.push("")
        pages[Math.floor(i/15)] += (formatName(c) + (c.amount > 1? `(x${c.amount})\n` : '\n'))
    })

    return await addPagination(ctx, user, `matched cards from database (${cards.length} results)`, pages)
}))

cmd('sell', withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.reply(user, `please specify a card`, 'red')

    const pending = await check_trs(ctx, user, parsedargs.id)
    if(pending)
        return ctx.reply(user, `you already have pending unconfirmed transaction to **${pending.to}**. 
            You must resolve that transaction before setting up a new one`, 'red')

    if(!ctx.msg.channel.guild)
        return ctx.reply(user, `transactions are possible only in guild channel`, 'red')

    const prm = { confirm: [parsedargs.id], decline: [user.discord_id, parsedargs.id] }

    const card = bestMatch(cards)
    const price = await evalCard(ctx, card, .4)
    const trs = await new_trs(ctx, user, card, price, parsedargs.id)
    const footer = `ID: \`${trs.id}\``

    let question = ""
    if(parsedargs.id) {
        question = `**${trs.to}**, **${trs.from}** wants to sell you **${formatName(card)}** for **${price}** {currency}`
    } else {
        question = `**${trs.from}**, do you want to sell **${formatName(card)}** to **bot** for **${price}** {currency}?`
        prm.confirm.push(user.discord_id)
    }

    addConfirmation(ctx, user, question, prm, 
        (x) => confirm_trs(ctx, x, trs.id), 
        (x) => decline_trs(ctx, x, trs.id), 
        footer)
}))

cmd('eval', withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const card = bestMatch(cards)
    const price = await evalCard(ctx, card)
    return ctx.reply(user, `card ${formatName(card)} is worth **${price}** {currency}`)
}))

cmd('fav', withCards(async (ctx, user, cards, parsedargs) => {
    const card = bestMatch(cards)

    if(card.fav)
        return ctx.reply(user, `card ${formatName(card)} is already marked as favourite`, 'red')

    user.cards[user.cards.findIndex(x => x.id == card.id)].fav = true
    user.markModified('cards')
    await user.save()

    return ctx.reply(user, `marked ${formatName(card)} as favourite`)
}))

cmd(['fav', 'all'], withCards(async (ctx, user, cards, parsedargs) => {
    const prm = { confirm: [user.discord_id], decline: [user.discord_id] }
    addConfirmation(ctx, user, `do you want to mark **${cards.length}** cards as favourite?`, prm, 
        async (x) => {
            cards.map(c => {
                 user.cards[user.cards.findIndex(x => x.id == c.id)].fav = true
            })

            user.markModified('cards')
            await user.save()

            return ctx.reply(user, `marked **${cards.length}** cards as favourite`)
        }, async (x) => {
            return ctx.reply(user, `fav operation was declined`, 'red')
        }, `Favourite cards can be accessed with -fav`)
}))

cmd('unfav', withCards(async (ctx, user, cards, parsedargs) => {
    const card = bestMatch(cards)

    if(!card.fav)
        return ctx.reply(user, `card ${formatName(card)} is not marked as favourite`, 'red')

    user.cards[user.cards.findIndex(x => x.id == card.id)].fav = false
    user.markModified('cards')
    await user.save()

    return ctx.reply(user, `removed ${formatName(card)} frome favourites`)
}))

cmd(['unfav', 'all'], withCards(async (ctx, user, cards, parsedargs) => {
    const prm = { confirm: [user.discord_id], decline: [user.discord_id] }
    addConfirmation(ctx, user, `do you want remove **${cards.length}** cards frome favourites?`, prm, 
        async (x) => {
            cards.map(c => {
                 user.cards[user.cards.findIndex(x => x.id == c.id)].fav = false
            })

            user.markModified('cards')
            await user.save()

            return ctx.reply(user, `removed **${cards.length}** cards frome favourites`)
        }, async (x) => {
            return ctx.reply(user, `fav operation was declined`, 'red')
        })
}))

cmd('info', ['card', 'info'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const card = bestMatch(cards)
    const price = await evalCard(ctx, card)
    const tags = await fetchCardTags(card)
    const col = bestColMatch(ctx, card.col)

    const resp = []
    resp.push(formatName(card))
    resp.push(`Fandom: **${col.name}**`)
    resp.push(`Price: **${price}** {currency}`)
    resp.push(`Average Rating: **none**`)

    if(tags && tags.length > 0)
        resp.push(`Tags: **#${tags.join(' #')}**`)

    return ctx.send(ctx.msg.channel.id, {
        description: resp.join('\n'),
        color: colors['blue']
    }, user.discord_id)
}))