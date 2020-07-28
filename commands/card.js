const {cmd}                 = require('../utils/cmd')
const {fetchCardTags}       = require('../modules/tag')
const colors                = require('../utils/colors')
const msToTime              = require('pretty-ms')
const dateFormat            = require(`dateformat`)

const _ = require('lodash')

const {
    claimCost, 
    promoClaimCost
} = require('../utils/tools')

const {
    bestColMatch,
    completed
} = require('../modules/collection')

const {
    evalCard, 
    getVialCost
} = require('../modules/eval')

const {
    new_trs,
    confirm_trs,
    decline_trs,
    getPendingFrom
} = require('../modules/transaction')

const {
    formatName,
    addUserCard,
    withCards,
    withGlobalCards,
    bestMatch,
    fetchInfo,
} = require('../modules/card')

const {
    addGuildXP,
    getBuilding
} = require('../modules/guild')

const {
    check_effect
} = require('../modules/effect')

cmd('claim', 'cl', async (ctx, user, ...args) => {
    const cards = []
    const now = new Date()

    let promo, boost, any
    if(args.indexOf('promo') != -1) {
        promo = ctx.promos.find(x => x.starts < now && x.expires > now)
        if(!promo)
            return ctx.reply(user, `no events are running right now. Please use regular claim`, 'red')
    }

    if (args.indexOf('any') !== -1) {
        any = true
    }

    const amount = args.filter(x => x.length < 3 && !isNaN(x)).map(x => Math.abs(parseInt(x)))[0] || 1
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

    if(!promo) {
        boost = curboosts.find(x => args.some(y => y === x.id))
    }

    const lock = (ctx.guild.overridelock && !any? ctx.guild.overridelock: null) || (ctx.guild.lockactive && !any? ctx.guild.lock : null)
    const tohruEffect = (!user.dailystats.claims || user.dailystats.claims === 0) && check_effect(ctx, user, 'tohrugift')
    for (let i = 0; i < amount; i++) {
        const rng = Math.random()
        const spec = ((gbank && gbank.level > 1)? _.sample(ctx.collections.filter(x => x.rarity > rng)) : null)
        const col = promo || spec || (lock? ctx.collections.find(x => x.id === lock) 
            : _.sample(ctx.collections.filter(x => !x.rarity && !x.promo)))
        let card, boostdrop = false
        const colCards = ctx.cards.filter(x => x.col === col.id)
        if(i === 0 && tohruEffect && colCards.some(x => x.level === 3)) {
            card = _.sample(colCards.filter(x => x.level === 3 && !x.excluded))
        }
        else if(boost && rng < boost.rate) {
            boostdrop = true
            card = ctx.cards[_.sample(boost.cards)]
        }
        else card = _.sample(colCards.filter(x => x.level < 5 && !x.excluded))

        const count = addUserCard(user, card.id)

        await completed(ctx, user, card)

        cards.push({count, boostdrop, card: _.clone(card)})
    }
    
    cards.sort((a, b) => b.card.level - a.card.level)

    let curr = ctx.symbols.tomato, max = 1
    const extra = Math.round(price * .25)
    const newCards = cards.filter(x => x.count === 1)
    const oldCards = cards.filter(x => x.count > 1)
    oldCards.map(x => x.card.fav = user.cards.find(y => x.card.id === y.id).fav)

    if(promo) {
        curr = promo.currency
        user.promoexp -= price
        await user.updateOne({$inc: {'dailystats.promoclaims': amount}})
        user.dailystats.promoclaims = user.dailystats.promoclaims + amount || amount
        while(promoClaimCost(user, max) < user.promoexp)
            max++
    } else {
        user.exp -= price
        user.promoexp += extra
        await user.updateOne({$inc: {'dailystats.claims': amount}})
        user.dailystats.claims = user.dailystats.claims + amount || amount
        while(claimCost(user, ctx.guild.tax, max) < user.exp)
            max++
    }

    user.lastcard = cards[0].card.id
    user.xp += amount
    await user.save()
    
    if(newCards.length > 0 && oldCards.length > 0) {
        user.markModified('cards')
        await user.save()
    }

    if(price != normalprice) {
        ctx.guild.balance += Math.round(price - normalprice)
    }

    addGuildXP(ctx, user, amount)
    await ctx.guild.save()

    let fields = []
    let description = `**${user.username}**, you got:`
    fields.push({name: `New cards`, value: newCards.map(x => `${x.boostdrop? '`🅱` ' : ''}${formatName(x.card)}`).join('\n')})
    fields.push({name: `Duplicates`, value: oldCards.map(x => `${x.boostdrop? '`🅱` ' : ''}${formatName(x.card)} #${x.count}`).join('\n')})
    fields.push({name: `Receipt`, value: `You spent **${price}** ${curr} in total
        You have **${Math.round(promo? user.promoexp : user.exp)}** ${curr} left
        You can claim **${max - 1}** more cards
        Your next claim will cost **${promo? promoClaimCost(user, 1) : claimCost(user, ctx.guild.tax, 1)}** ${curr}`})
    /*fields.push({name: `External view`, value:
        `[view your claimed cards here](http://noxcaos.ddns.net:3000/cards?type=claim&ids=${cards.map(x => x.card.id).join(',')})`})*/

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
            image: { url: '' }
        }
    })
})

cmd('sum', 'summon', withCards(async (ctx, user, cards, parsedargs) => {
    const card = parsedargs.isEmpty()? _.sample(cards) : bestMatch(cards)
    user.lastcard = card.id
    await user.save()

    if(card.imgur) {
        await ctx.reply(user, {
            color: colors.blue,
            description: `summons **${formatName(card)}**!`
        })

        return ctx.bot.createMessage(ctx.msg.channel.id, card.imgur)
    }

    return ctx.reply(user, {
        image: { url: card.url },
        color: colors.blue,
        description: `summons **${formatName(card)}**!`
    })
})).access('dm')

cmd(['ls', 'global'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    cards = cards.filter(x => !x.excluded)
    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(cards.map(c => formatName(c)), 15),
        embed: {
            author: { name: `Matched cards from database (${cards.length} results)` },
        }
    })
})).access('dm')

cmd('sell', withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'sell')

    if(user.ban && user.ban.embargo)
        return ctx.reply(user, `you are not allowed to list cards at auction.
                                Your dealings were found to be in violation of our community rules.
                                You can inquire further on our [Bot Discord](https://discord.gg/kqgAvdX)`, 'red')

    const id = parsedargs.ids[0]
    const pending = await getPendingFrom(ctx, user)
    const pendingto = pending.filter(x => x.to_id === id)

    if(id && id === user.discord_id) {
        return ctx.reply(user, `you cannot sell cards to yourself.`, 'red')
    }

    if(!id && pendingto.length > 0)
        return ctx.reply(user, `you already have pending transaction to **BOT**. 
            First resolve transaction \`${pending[0].id}\``, 'red')
    else if(pendingto.length >= 5)
        return ctx.reply(user, `you already have pending transactions to **${pendingto[0].to}**. 
            You can have up to **5** pending transactions to the same user.
            Type \`->pending\` to see them`, 'red')

    cards = cards.filter(x => !pending.some(y => y.card === x.id))
    if(cards.length === 0) {
        return ctx.reply(user, `cannot find unique cards for this request.
            You cannot put the same card for sale several times`, 'red')
    }

    const card = bestMatch(cards)
    const usercard = user.cards.find(x => x.id === card.id)

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

    const price = await evalCard(ctx, card, id? 1 : .4)
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
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'fav')

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
        question: `**${user.username}**, do you want to mark **${cards.length}** cards as favourite?`,
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
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'draw')

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
        question: `**${user.username}**, do you want to remove **${cards.length}** cards from favourites?`,
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
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'info')

    const card = bestMatch(cards)
    const price = await evalCard(ctx, card)
    const tags = await fetchCardTags(card)
    const col = bestColMatch(ctx, card.col)

    const resp = []
    const extrainfo = await fetchInfo(card.id)
    const usercard = user.cards.find(x => x.id === card.id)
    const embed = { color: colors.blue, fields: [] }

    resp.push(formatName(card))
    resp.push(`Fandom: **${col.name}**`)
    resp.push(`Price: **${price}** ${ctx.symbols.tomato}`)

    if(extrainfo.ratingsum > 0)
        resp.push(`Average Rating: **${(extrainfo.ratingsum / extrainfo.usercount).toFixed(2)}**`)

    if(usercard && usercard.rating)
        resp.push(`Your Rating: **${usercard.rating}**`)

    resp.push(`Added: **${dateFormat(card.added, "yyyy-mm-dd")}** (${msToTime(new Date() - card.added, {compact: true})})`)
    resp.push(`ID: ${card.id}`)
    embed.description = resp.join('\n')

    if(tags && tags.length > 0) {
        embed.fields.push({name: `Tags`, value: `#${tags.slice(0, 4).map(x => x.name).join('\n#')}${tags.length > 4? '\n...' : ''}`})
    }

    return ctx.send(ctx.msg.channel.id, embed, user.discord_id)
}))

cmd('boost', 'boosts', (ctx, user) => {
    const now = new Date()
    const boosts = ctx.boosts
        .filter(x => x.starts < now && x.expires > now)
        .sort((a, b) => a.expires - b.expires)

    const description = boosts.map(x => 
        `[${msToTime(x.expires - now, {compact: true})}] **${x.rate * 100}%** drop rate for **${x.name}** when you run \`->claim ${x.id}\` (${x.cards.length} cards in pool)`).join('\n')

    return ctx.send(ctx.msg.channel.id, {
        description,
        color: colors.blue,
        title: `Current boosts`
    }, user.discord_id)
})

cmd('rate', withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'rate')

    if(!parsedargs.extra[0] || !parseInt(parsedargs.extra[0]))
        return ctx.reply(user, `please specify rating as a whole number after \`:\` (e.g. \`mycard :8\`)`, 'red')

    const rating = parseInt(parsedargs.extra[0])
    if(rating > 10 || rating < 1)
        return ctx.reply(user, `please specify rating from 1 to 10`, 'red')

    const card = bestMatch(cards)
    const info = await fetchInfo(card.id)
    if(card.rating) {
        const oldrating = card.rating
        info.ratingsum -= oldrating
        info.usercount--
    }

    user.cards.find(x => x.id === card.id).rating = rating
    info.ratingsum += rating
    info.usercount++

    user.markModified('cards')
    await user.save()
    await info.save()

    return ctx.reply(user, `set rating **${rating}** for ${formatName(card)}`)
})).access('dm')
