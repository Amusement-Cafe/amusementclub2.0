const {cmd}                 = require('../utils/cmd')
const {bestColMatch}        = require('../modules/collection')
const {fetchCardTags}       = require('../modules/tag')
const colors                = require('../utils/colors')

const _ = require('lodash')

const {
    claimCost, 
    promoClaimCost
} = require('../utils/tools')

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

cmd('claim', 'cl', async (ctx, user, ...args) => {
    const cards = []
    const now = new Date()

    let promo
    if(args.indexOf('promo') != -1) {
        promo = ctx.promos.filter(x => x.starts < now && x.expires > now)[0]
        if(!promo)
            return ctx.reply(user, `no events are running right now. Please use regular claim`, 'red')
    }

    const amount = args.filter(x => !isNaN(x)).map(x => parseInt(x))[0] || 1
    const price = promo? promoClaimCost(user, amount) : claimCost(user, ctx.guild.tax, amount)
    const normalprice = promo? price : claimCost(user, 0, amount)
    const gbank = getBuilding(ctx, 'gbank')
    const curboosts = ctx.boosts.filter(x => x.starts < now && x.expires > now)

    if(amount > 10)
        return ctx.reply(user, `you can claim only **10** or less cards with one command`, 'red')

    if(!promo && price > user.exp)
        return ctx.reply(user, `you need **${price}** ${ctx.symbols.tomato} to claim ${amount > 1? amount + ' cards' : 'a card'}. 
            You have **${Math.floor(user.exp)}** ${ctx.symbols.tomato}`, 'red')

    if(promo && price > user.promoexp)
        return ctx.reply(user, `you need **${price}** ${promo.currency} to claim ${amount > 1? amount + ' cards' : 'a card'}. 
            You have **${Math.floor(user.promoexp)}** ${promo.currency}`, 'red')

    const lock = ctx.guild.overridelock || (ctx.guild.lockactive? ctx.guild.lock : null)
    for (let i = 0; i < amount; i++) {
        const rng = Math.random()
        const spec = ((gbank && gbank.level > 1)? _.sample(ctx.collections.filter(x => x.rarity > rng)) : null)
        const col = promo || spec || (lock? ctx.collections.filter(x => x.id === lock)[0] 
            : _.sample(ctx.collections.filter(x => !x.rarity && !x.promo)))

        const card = _.sample(ctx.cards.filter(x => x.col === col.id && x.level < 5))
        const count = addUserCard(user, card.id)
        cards.push({count, card: _.clone(card)})
    }
    
    cards.sort((a, b) => b.card.level - a.card.level)

    const extra = Math.round(price * .25)
    const newCards = cards.filter(x => x.count === 1)
    const oldCards = cards.filter(x => x.count > 1)
    oldCards.map(x => x.card.fav = user.cards.filter(y => x.card.id === y.id)[0].fav)

    if(promo) {
        user.promoexp -= price
        user.dailystats.promoclaims = user.dailystats.promoclaims + amount || amount
    } else {
        user.exp -= price
        user.promoexp += extra
        user.dailystats.claims = user.dailystats.claims + amount || amount
    }

    user.lastcard = cards[0].card.id
    user.xp += amount
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
    let description = `**${user.username}**, you got:`
    fields.push({name: `New cards`, value: newCards.map(x => formatName(x.card)).join('\n')})
    fields.push({name: `Duplicates`, value: oldCards.map(x => `${formatName(x.card)} #${x.count}`).join('\n')})
    fields.push({name: `External view`, value: `[view your claimed cards here](http://noxcaos.ddns.net:3000/cards?type=claim&ids=${cards.map(x => x.card.id).join(',')})`})

    fields = fields.map(x => {
        if(x.value.length < 1024)
            return x

        description += `\n**${x.name}**\n${x.value}`
    }).filter(x => x && x.value)

    const pages = cards.map(x => x.card.url)
    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages,
        buttons: ['back', 'forward'],
        switchPage: (data) => data.embed.image.url = data.pages[data.pagenum],
        embed: {
            color: colors.blue,
            description,
            fields,
            image: { url: '' },
            footer: { text: `Your next claim will cost ${claimCost(user, ctx.guild.tax, 1)} ${ctx.symbols.tomato.replace(/`/gi, '')}` }
        }
    })
})

cmd('sum', 'summon', withCards(async (ctx, user, cards, parsedargs) => {
    const card = parsedargs.isEmpty()? _.sample(cards) : bestMatch(cards)
    user.lastcard = card.id
    await user.save()

    return ctx.reply(user, {
        image: { url: card.url },
        color: colors.blue,
        description: `summons **${formatName(card)}**!`
    })
})).access('dm')

cmd(['ls', 'global'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(cards.map(c => formatName(c)), 15),
        embed: {
            author: { name: `Matched cards from database (${cards.length} results)` },
        }
    })
})).access('dm')

cmd('sell', withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.reply(user, `please specify a card`, 'red')

    const id = parsedargs.ids[0]
    const card = bestMatch(cards)
    const usercard = user.cards.filter(x => x.id === card.id)[0]
    const pending = await getPendingFrom(ctx, user)
    const pendingto = pending.filter(x => x.to === id)

    if(!id && pendingto.length > 0)
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

    const perms = { confirm: [id], decline: [user.discord_id, id] }

    const price = await evalCard(ctx, card, parsedargs.id? 1 : .4)
    const trs = await new_trs(ctx, user, card, price, id)

    let question = ""
    if(id) {
        question = `**${trs.to}**, **${trs.from}** wants to sell you **${formatName(card)}** for **${price}** ${ctx.symbols.tomato}`
    } else {
        question = `**${trs.from}**, do you want to sell **${formatName(card)}** to **bot** for **${price}** ${ctx.symbols.tomato}?`
        perms.confirm.push(user.discord_id)
    }

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        embed: { footer: { text: `ID: \`${trs.id}\`` } },
        force: ctx.globals.force,
        question,
        perms,
        onConfirm: (x) => confirm_trs(ctx, x, trs.id),
        onDecline: (x) => decline_trs(ctx, x, trs.id)
    })
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
})).access('dm')

cmd(['fav', 'all'], withCards(async (ctx, user, cards, parsedargs) => {
    cards = cards.filter(x => !x.fav)

    if(cards.length === 0)
        return ctx.reply(user, `all cards from that request are already marked as favourite`, 'red')

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        embed: { footer: { text: `Favourite cards can be accessed with -fav` } },
        force: ctx.globals.force,
        question: `do you want to mark **${cards.length}** cards as favourite?`,
        onConfirm: async (x) => {
            cards.map(c => {
                 user.cards[user.cards.findIndex(x => x.id == c.id)].fav = true
            })

            user.markModified('cards')
            await user.save()

            return ctx.reply(user, `marked **${cards.length}** cards as favourite`)
        }
    })
})).access('dm')

cmd('unfav', ['fav', 'remove'], withCards(async (ctx, user, cards, parsedargs) => {
    const card = bestMatch(cards)

    if(!card.fav)
        return ctx.reply(user, `card ${formatName(card)} is not marked as favourite`, 'red')

    user.cards[user.cards.findIndex(x => x.id == card.id)].fav = false
    user.markModified('cards')
    await user.save()

    return ctx.reply(user, `removed ${formatName(card)} from favourites`)
})).access('dm')

cmd(['unfav', 'all'], ['fav', 'remove', 'all'], withCards(async (ctx, user, cards, parsedargs) => {
    cards = cards.filter(x => x.fav)

    if(cards.length === 0)
        return ctx.reply(user, `no favourited cards found`, 'red')

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        force: ctx.globals.force,
        question: `do you want to remove **${cards.length}** cards from favourites?`,
        onConfirm: async (x) => {
            cards.map(c => {
                 user.cards[user.cards.findIndex(x => x.id == c.id)].fav = false
            })

            user.markModified('cards')
            await user.save()

            return ctx.reply(user, `removed **${cards.length}** cards from favourites`)
        }
    })
})).access('dm')

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
