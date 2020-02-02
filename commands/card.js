const {claimCost}           = require('../utils/tools')
const {cmd}                 = require('../utils/cmd')
const {addConfirmation}     = require('../utils/confirmator')
const {addPagination}       = require('../utils/paginator')
const {bestColMatch}        = require('../modules/collection')
const {fetchCardTags}       = require('../modules/tag')
const colors                = require('../utils/colors')

const _ = require('lodash')

const {
    evalCard, 
    getVialCost
} = require('../modules/eval')

const {
    new_trs,
    confirm_trs,
    decline_trs,
    check_trs,
    getPendingFrom
} = require('../modules/transaction')

const {
    formatName,
    addUserCard,
    withCards,
    withGlobalCards,
    bestMatch,
} = require('../modules/card')

const {
    addGuildXP,
    getBuilding
} = require('../modules/guild')

cmd('claim', 'cl', async (ctx, user, arg1) => {
    const cards = []
    const amount = parseInt(arg1) || 1
    const price = claimCost(user, ctx.guild.tax, amount)
    const normalprice = claimCost(user, 0, amount)
    const gbank = getBuilding(ctx, 'gbank')

    if(amount > 10)
        return ctx.reply(user, `you can claim only **10** or less cards with one command`, 'red')

    if(price > user.exp)
        return ctx.reply(user, `you need **${price}** ${ctx.symbols.tomato} to claim ${amount > 1? amount + ' cards' : 'a card'}. 
            You have **${Math.floor(user.exp)}** ${ctx.symbols.tomato}`, 'red')

    const lock = ctx.guild.overridelock || (ctx.guild.lockactive? ctx.guild.lock : null)
    for (let i = 0; i < amount; i++) {
        const rng = Math.random()
        const spec = ((gbank && gbank.level > 1)? _.sample(ctx.collections.filter(x => x.rarity > rng)) : null)
        const col = spec || (lock? ctx.collections.filter(x => x.id === lock)[0] : _.sample(ctx.collections.filter(x => !x.rarity)))
        const card = _.sample(ctx.cards.filter(x => x.col === col.id && x.level < 5))
        const count = addUserCard(user, card.id)
        cards.push({count, card: _.clone(card)})
    }
    
    cards.sort((a, b) => b.card.level - a.card.level)

    const newCards = cards.filter(x => x.count === 1)
    const oldCards = cards.filter(x => x.count > 1)
    oldCards.map(x => x.card.fav = user.cards.filter(y => x.card.id === y.id)[0].fav)

    user.exp -= price
    user.xp += amount
    user.dailystats.claims = user.dailystats.claims + amount || amount
    user.markModified('dailystats')
    await user.save()
    
    if(newCards.length > 0 && oldCards.length > 0) {
        user.markModified('cards')
        await user.save()
    }

    if(price != normalprice) {
        addGuildXP(ctx, user, amount)
        ctx.guild.balance += Math.round(price - normalprice)
        await ctx.guild.save()
    }

    let fields = []
    let description = `you got:`
    fields.push({name: `New cards`, value: newCards.map(x => formatName(x.card)).join('\n')})
    fields.push({name: `Duplicates`, value: oldCards.map(x => `${formatName(x.card)} #${x.count}`).join('\n')})
    fields.push({name: `External view`, value: `[view your claimed cards here](http://noxcaos.ddns.net:3000/cards?type=claim&ids=${cards.map(x => x.card.id).join(',')})`})

    fields = fields.map(x => {
        if(x.value.length < 1024)
            return x

        description += `\n**${x.name}**\n${x.value}`
    }).filter(x => x && x.value)

    return ctx.reply(user, {
        image: { url: cards[0].card.url },
        color: colors.blue,
        description,
        fields,
        footer: { text: `Your next claim will cost ${claimCost(user, ctx.guild.tax, 1)} ${ctx.symbols.tomato.replace(/`/gi, '')}` }
    })
})

cmd('sum', 'summon', withCards(async (ctx, user, cards, parsedargs) => {
    const card = parsedargs.isEmpty()? _.sample(cards) : bestMatch(cards)
    return ctx.reply(user, {
        image: { url: card.url },
        color: colors.blue,
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

    const card = bestMatch(cards)
    const usercard = user.cards.filter(x => x.id === card.id)[0]
    const pending = await getPendingFrom(ctx, user)
    const pendingto = pending.filter(x => x.to === parsedargs.id)

    if(!parsedargs.id && pendingto.length > 0)
        return ctx.reply(user, `you already have pending transaction to **BOT**. 
            First resolve transaction \`${pending[0].id}\``, 'red')
    else if(pendingto.length >= 5)
        return ctx.reply(user, `you already have pending transactions to **${pending[0].to}**. 
            You can have up to **5** pending transactions to the same user.
            Type \`->pending\` to see them`, 'red')

    if(pending.length > 0) {
        const cursales = pending.filter(x => x.card === card.id)
        const diff = usercard.amount - cursales.length
        if(diff <= 0)
            return ctx.reply(user, `you cannot put up more sales of this card. 
                You have **${cursales.length}** copies that are already on sale (${cursales.map(x => `\`${x.id}\``).join(' | ')})`, 'red')
        else if(diff === 1 && usercard.fav)
            return ctx.reply(user, `you are about to put up last copy of your favourite card for sale. 
                Please, use \`->fav remove ${card.name}\` to remove it from favourites first`, 'yellow')
    }

    if(usercard.fav && usercard.amount === 1) {
        return ctx.reply(user, `you are about to put up last copy of your favourite card for sale. 
            Please, use \`->fav remove ${card.name}\` to remove it from favourites first`, 'yellow')
    }

    if(!ctx.msg.channel.guild)
        return ctx.reply(user, `transactions are possible only in guild channel`, 'red')

    const prm = { confirm: [parsedargs.id], decline: [user.discord_id, parsedargs.id] }

    const price = await evalCard(ctx, card, parsedargs.id? 1 : .4)
    const trs = await new_trs(ctx, user, card, price, parsedargs.id)
    const footer = `ID: \`${trs.id}\``

    let question = ""
    if(parsedargs.id) {
        question = `**${trs.to}**, **${trs.from}** wants to sell you **${formatName(card)}** for **${price}** ${ctx.symbols.tomato}`
    } else {
        question = `**${trs.from}**, do you want to sell **${formatName(card)}** to **bot** for **${price}** ${ctx.symbols.tomato}?`
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
    const vials = await getVialCost(ctx, card, price)
    return ctx.reply(user, 
        `card ${formatName(card)} is worth: **${price}** ${ctx.symbols.tomato} ${card.level < 4? `and **${vials}** ${ctx.symbols.vial}` : ``}`)
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
    cards = cards.filter(x => !x.fav)

    if(cards.length === 0)
        return ctx.reply(user, `all cards from that request are already marked as favourite`, 'red')

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

cmd('unfav', ['fav', 'remove'], withCards(async (ctx, user, cards, parsedargs) => {
    const card = bestMatch(cards)

    if(!card.fav)
        return ctx.reply(user, `card ${formatName(card)} is not marked as favourite`, 'red')

    user.cards[user.cards.findIndex(x => x.id == card.id)].fav = false
    user.markModified('cards')
    await user.save()

    return ctx.reply(user, `removed ${formatName(card)} from favourites`)
}))

cmd(['unfav', 'all'], ['fav', 'remove', 'all'], withCards(async (ctx, user, cards, parsedargs) => {
    cards = cards.filter(x => x.fav)

    if(cards.length === 0)
        return ctx.reply(user, `no favourited cards found`, 'red')

    const prm = { confirm: [user.discord_id], decline: [user.discord_id] }
    addConfirmation(ctx, user, `do you want to remove **${cards.length}** cards from favourites?`, prm, 
        async (x) => {
            cards.map(c => {
                 user.cards[user.cards.findIndex(x => x.id == c.id)].fav = false
            })

            user.markModified('cards')
            await user.save()

            return ctx.reply(user, `removed **${cards.length}** cards from favourites`)
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
    resp.push(`Price: **${price}** ${ctx.symbols.tomato}`)
    resp.push(`Average Rating: **none**`)
    resp.push(`ID: ${card.id}`)

    if(tags && tags.length > 0)
        resp.push(`Tags: **#${tags.join(' #')}**`)

    return ctx.send(ctx.msg.channel.id, {
        description: resp.join('\n'),
        color: colors['blue']
    }, user.discord_id)
}))
