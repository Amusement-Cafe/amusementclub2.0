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
    getVialCost,
    getQueueTime,
    evalCardFast,
    bulkIncrementUserCount,
} = require('../modules/eval')

const {
    new_trs,
    confirm_trs,
    decline_trs,
    validate_trs,
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

const {
    check_effect
} = require('../modules/effect')

const {
    fetchInfo,
} = require('../modules/meta')

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
    const activepromo = ctx.promos.find(x => x.starts < now && x.expires > now)

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
        if (activepromo){
            user.promoexp += extra
        }
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

    if(newCards.length > 0) {
        bulkIncrementUserCount(ctx, newCards.map(x => x.card.id))
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
        Your next claim will cost **${promo? promoClaimCost(user, 1) : claimCost(user, ctx.guild.tax, 1)}** ${curr}
        ${activepromo && !promo? `You got **${extra}** ${activepromo.currency}
        You now have **${user.promoexp}** ${activepromo.currency}` : ""}`.replace(/\s\s+/gm, '\n')})
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

    const evalTime = getQueueTime()
    if(evalTime > 0 && parsedargs.evalQuery) {
        ctx.reply(user, {
            color: colors.yellow,
            description: `current result might not be accurate because some of the cards are still processing their eval.
                Please check in **${msToTime(evalTime)}** for more accurate results.`
        })
    }

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

    const id = parsedargs.ids[0]
    const targetuser = id? await User.findOne({ discord_id: to_id }) : null
    const err = await validate_trs(ctx, user, cards, id, targetuser)
    if(err) {
        return ctx.reply(user, err, 'red')
    }

    const card = bestMatch(cards)
    const perms = { confirm: [id], decline: [user.discord_id, id] }
    const price = await evalCard(ctx, card, targetuser? 1 : .4)
    const trs = await new_trs(ctx, user, [card], price, targetuser? targetuser.discord_id : null)

    let question = ""
    if(trs.to != 'bot') {
        question = `**${trs.to}**, **${trs.from}** wants to sell you **${formatName(card)}** for **${price}** ${ctx.symbols.tomato}`
    } else {
        question = `**${trs.from}**, do you want to sell **${formatName(card)}** to **bot** for **${price}** ${ctx.symbols.tomato}?`
        perms.confirm.push(user.discord_id)
    }

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        embed: { footer: { text: `ID: \`${trs.id}\`` } },
        force: trs.to === 'bot'? ctx.globals.force : false,
        question,
        perms,
        onConfirm: (x) => confirm_trs(ctx, x, trs.id),
        onDecline: (x) => decline_trs(ctx, x, trs.id)
    })
}))

cmd(['sell', 'all'], withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'sell')

    const id = parsedargs.ids[0]
    const targetuser = id? await User.findOne({ discord_id: to_id }) : null
    const err = await validate_trs(ctx, user, cards, id, targetuser)
    if(err) {
        return ctx.reply(user, err, 'red')
    }

    const perms = { confirm: [id], decline: [user.discord_id, id] }

    let price = 0
    cards.forEach(card => {
        const eval = evalCardFast(ctx, card) * (targetuser? 1 : .4)
        if(eval >= 0) {
            price += Math.round(eval)
        } else {
            price = NaN
        }
    })

    if(isNaN(price)) {
        const evalTime = getQueueTime()
        return ctx.reply(user, `some cards from this request need price evaluation.
            Please try again in **${msToTime(evalTime)}**.`, 'yellow')
    }

    const trs = await new_trs(ctx, user, cards, price, targetuser? targetuser.discord_id : null)

    let question = ""
    if(trs.to != 'bot') {
        question = `**${trs.to}**, **${trs.from}** wants to sell you **${cards.length} cards** for **${price}** ${ctx.symbols.tomato}`
    } else {
        question = `**${trs.from}**, do you want to sell **${cards.length} cards** to **bot** for **${price}** ${ctx.symbols.tomato}?`
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
        `card ${formatName(card)} is worth: **${price}** ${ctx.symbols.tomato} ${card.level < 4? `or **${vials}** ${ctx.symbols.vial}` : ``}`)
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

cmd('boost', 'boosts', (ctx, user) => {
    const now = new Date()
    const boosts = ctx.boosts
        .filter(x => x.starts < now && x.expires > now)
        .sort((a, b) => a.expires - b.expires)

    if(boosts.length === 0) {
        return ctx.reply(user, `no current boosts`, 'red')
    }

    const description = boosts.map(x => 
        `[${msToTime(x.expires - now, {compact: true})}] **${x.rate * 100}%** rate for **${x.name}** (\`${ctx.prefix}claim ${x.id}\`)`).join('\n')

    return ctx.send(ctx.msg.channel.id, {
        description,
        color: colors.blue,
        title: `Current boosts`
    }, user.discord_id)
})

cmd(['boost', 'info'], (ctx, user, args) => {
    const now = new Date()
    const id = args.split(' ')[0]
    const boost = ctx.boosts.find(x => x.id === id)

    if(!boost) {
        return ctx.reply(user, `boost with ID \`${id}\` was not found.`, 'red')
    }

    const list = []
    list.push(`Rate: **${boost.rate * 100}%**`)
    list.push(`Cards in pool: **${boost.cards.length}**`)
    list.push(`Command: \`${ctx.prefix}claim ${boost.id}\``)
    list.push(`Expires in **${msToTime(boost.expires - now)}**`)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(boost.cards.map(c => formatName(ctx.cards[c])), 10),
        switchPage: (data) => data.embed.fields[0].value = data.pages[data.pagenum],
        embed: {
            author: { name: `${boost.name} boost` },
            description: list.join('\n'),
            color: colors.blue,
            fields: [{
                name: "You can get any of these cards:",
                value: ""
            }]
        }
    })
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
    const info = fetchInfo(ctx, card.id)
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

cmd(['rate', 'remove'], ['unrate'], withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'rate')

    const card = bestMatch(cards)
    const info = fetchInfo(ctx, card.id)
    if(card.rating) {
        const oldrating = card.rating
        user.cards.find(x => x.id === card.id).rating -= oldrating
        //These are only here because I ran into this causing a negative usercount/rating
        if (info.ratingsum != 0) {
            info.ratingsum -= oldrating
        }
        if (info.usercount != 0) {
            info.usercount--
        }
    } else {
        return ctx.reply(user, 'you have not set a rating for that card!', 'red')
    }

    user.markModified('cards')
    await user.save()
    await info.save()

    return ctx.reply(user, `removed rating for ${formatName(card)}`)
})).access('dm')
