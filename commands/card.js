const {cmd}                 = require('../utils/cmd')
const {fetchCardTags}       = require('../modules/tag')
const colors                = require('../utils/colors')
const msToTime              = require('pretty-ms')
const dateFormat            = require(`dateformat`)
const User                  = require('../collections/user')

const _ = require('lodash')

const {
    claimCost, 
    promoClaimCost,
    numFmt,
} = require('../utils/tools')

const {
    bestColMatch,
    completed,
} = require('../modules/collection')

const {
    evalCard, 
    getVialCost,
    getQueueTime,
    evalCardFast,
    bulkIncrementUserCount,
    getVialCostFast,
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
} = require('../modules/guild')

const {
    check_effect,
} = require('../modules/effect')

const {
    fetchInfo,
} = require('../modules/meta')

const {
    plotPayout,
} = require('../modules/plot')

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
    const curboosts = ctx.boosts.filter(x => x.starts < now && x.expires > now)
    const activepromo = ctx.promos.find(x => x.starts < now && x.expires > now)

    if(amount > 10)
        return ctx.reply(user, `you can claim only **10** or less cards with one command`, 'red')

    if(!promo && price > user.exp)
        return ctx.reply(user, `you need **${numFmt(price)}** ${ctx.symbols.tomato} to claim ${amount > 1? amount + ' cards' : 'a card'}. 
            You have **${numFmt(Math.floor(user.exp))}** ${ctx.symbols.tomato}`, 'red')

    if(promo && price > user.promoexp)
        return ctx.reply(user, `you need **${numFmt(price)}** ${promo.currency} to claim ${amount > 1? amount + ' cards' : 'a card'}. 
            You have **${numFmt(Math.floor(user.promoexp))}** ${promo.currency}`, 'red')

    if(!promo) {
        boost = curboosts.find(x => args.some(y => y === x.id))
    }

    const lock = (ctx.guild.overridelock && !any? ctx.guild.overridelock: null) || (ctx.guild.lockactive && !any? ctx.guild.lock : null)
    const tohruEffect = (!user.dailystats.claims || user.dailystats.claims === 0) && check_effect(ctx, user, 'tohrugift')
    for (let i = 0; i < amount; i++) {
        const rng = Math.random()
        const spec = _.sample(ctx.collections.filter(x => x.rarity > rng))
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
        user.dailystats.totalregclaims += amount
        while(claimCost(user, ctx.guild.tax, max) < user.exp)
            max++
    }

    user.lastcard = cards[0].card.id
    user.xp += amount
    await user.save()

    await plotPayout(ctx, 'gbank', 1, amount)
    
    if(newCards.length > 0 && oldCards.length > 0) {
        user.markModified('cards')
        await user.save()
    }

    if(newCards.length > 0) {
        await bulkIncrementUserCount(ctx, newCards.map(x => x.card.id))
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
    fields.push({name: `Receipt`, value: `You spent **${numFmt(price)}** ${curr} in total
        You have **${numFmt(Math.round(promo? user.promoexp : user.exp))}** ${curr} left
        You can claim **${max - 1}** more cards
        Your next claim will cost **${promo? numFmt(promoClaimCost(user, 1)) : numFmt(claimCost(user, ctx.guild.tax, 1))}** ${curr}
        ${activepromo && !promo? `You got **${numFmt(extra)}** ${activepromo.currency}
        You now have **${numFmt(user.promoexp)}** ${activepromo.currency}` : ""}`.replace(/\s\s+/gm, '\n')})
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

cmd(['ls', 'global'], ['cards', 'global'], ['li', 'global'], ['list', 'global'], 
    withGlobalCards(async (ctx, user, cards, parsedargs) => {
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
            author: { name: `Matched cards from database (${numFmt(cards.length)} results)` },
        }
    })
})).access('dm')

cmd('sell', withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'sell')

    const id = parsedargs.ids[0]
    const targetuser = id? await User.findOne({ discord_id: id }) : null
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
        question = `**${trs.to}**, **${trs.from}** wants to sell you **${formatName(card)}** for **${numFmt(price)}** ${ctx.symbols.tomato}`
    } else {
        question = `**${trs.from}**, do you want to sell **${formatName(card)}** to **bot** for **${numFmt(price)}** ${ctx.symbols.tomato}?`
        perms.confirm.push(user.discord_id)
    }

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        embed: { footer: { text: `ID: \`${trs.id}\`` } },
        force: trs.to === 'bot'? ctx.globals.force : false,
        question,
        perms,
        onConfirm: (x) => confirm_trs(ctx, x, trs.id),
        onDecline: (x) => decline_trs(ctx, x, trs.id),
        onTimeout: (x) => ctx.pgn.sendTimeout(ctx.msg.channel.id, `**${trs.from}** tried to sell **${formatName(card)}** to **${trs.to}**. This is now a pending transaction with ID \`${trs.id}\``)
    })
}))

cmd(['sell', 'all'], withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'sell')

    const id = parsedargs.ids[0]
    const targetuser = id? await User.findOne({ discord_id: id }) : null
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
        question = `**${trs.to}**, **${trs.from}** wants to sell you **${cards.length} cards** for **${numFmt(price)}** ${ctx.symbols.tomato}`
    } else {
        question = `**${trs.from}**, do you want to sell **${cards.length} cards** to **bot** for **${numFmt(price)}** ${ctx.symbols.tomato}?`
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

cmd(['sell', 'preview'], withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'sell')

    cards.splice(25, cards.length)

    const id = parsedargs.ids[0]

    let price = 0
    const resp = cards.map(card => {
        const eval = evalCardFast(ctx, card) * (id? 1 : .4)
        if(eval >= 0) {
            price += Math.round(eval)
        } else {
            price = NaN
        }

        return {
            eval,
            cardname: `**${eval.toFixed(0)}** ${ctx.symbols.tomato} - ${formatName(card)}`,
        }
    })

    if(isNaN(price)) {
        const evalTime = getQueueTime()
        return ctx.reply(user, `some cards from this request need price evaluation.
            Please try again in **${msToTime(evalTime)}**.`, 'yellow')
    }

    resp.sort((a, b) => b.eval - a.eval)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(resp.map(x => x.cardname), 10),
        embed: {
            author: { name: `Sell all preview (total ${numFmt(price)} ${ctx.symbols.tomato})` },
            description: '',
            color: colors.blue,
        }
    })

}))

cmd('eval', withGlobalCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'eval')

    const card = bestMatch(cards)
    const price = await evalCard(ctx, card)
    const vials = await getVialCost(ctx, card, price)
    return ctx.reply(user, 
        `card ${formatName(card)} is worth: **${numFmt(price)}** ${ctx.symbols.tomato} ${card.level < 4? `or **${numFmt(vials)}** ${ctx.symbols.vial}` : ``}`)
}))

cmd(['eval', 'all'], withCards(async (ctx, user, cards, parsedargs) => {

    let price = 0
    let vials = 0
    cards.map(card => {
        const eval = evalCardFast(ctx, card)
        if(eval >= 0) {
            price += Math.round(eval) * card.amount
        } else {
            price = NaN
        }
        if(card.level < 4 && eval > 0) {
            vials += getVialCostFast(ctx, card, eval) * card.amount
        }
    })
    
    if(isNaN(price)) {
        const evalTime = getQueueTime()
        return ctx.reply(user, {
            color: colors.yellow,
            description: `some of your cards are still processing their eval.
                Please check in **${msToTime(evalTime)}** for more accurate results.`
        }, 'yellow')
    }

    return ctx.reply(user, 
        `request contains **${cards.length}** of your cards worth **${numFmt(price)}** ${ctx.symbols.tomato} 
        ${vials > 0? `or **${numFmt(vials)}** ${ctx.symbols.vial} (for less than 4 stars)` : ``}`)
}))

cmd(['eval', 'all', 'global'], withGlobalCards(async (ctx, user, cards, parsedargs) => {

    let price = 0
    let vials = 0
    cards.map(card => {
        const eval = evalCardFast(ctx, card)
        if(eval >= 0) {
            price += Math.round(eval)
        } else {
            price = NaN
        }
        if(card.level < 4 && eval > 0) {
            vials += getVialCostFast(ctx, card, eval)
        }
    })
    
    if(isNaN(price)) {
        const evalTime = getQueueTime()
        return ctx.reply(user, {
            color: colors.yellow,
            description: `some cards are still processing their eval.
                Please check in **${msToTime(evalTime)}** for more accurate results.`
        }, 'yellow')
    }

    return ctx.reply(user, 
        `your request contains **${cards.length}** cards worth **${numFmt(price)}** ${ctx.symbols.tomato} 
        ${vials > 0? `or **${numFmt(vials)}** ${ctx.symbols.vial} (for less than 4 stars)` : ``}`)
}))

cmd('fav', withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'fav')

    const unfaved = cards.filter(x => !x.fav)
    let card = bestMatch(unfaved)

    if(!card) {
        card = bestMatch(cards)
        return ctx.reply(user, `card ${formatName(card)} is already marked as favourite`, 'red')
    }

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
        question: `**${user.username}**, do you want to mark **${numFmt(cards.length)}** cards as favourite?`,
        onConfirm: async (x) => {
            cards.map(c => {
                 user.cards[user.cards.findIndex(x => x.id == c.id)].fav = true
            })

            user.markModified('cards')
            await user.save()

            return ctx.reply(user, `marked **${numFmt(cards.length)}** cards as favourite`)
        }
    })
})).access('dm')

cmd('unfav', ['fav', 'remove'], withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'fav')

    const faved = cards.filter(x => x.fav)
    let card = bestMatch(faved)

    if(!card) {
        card = bestMatch(cards)
        return ctx.reply(user, `card ${formatName(card)} is not marked as favourite`, 'red')
    }

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
        question: `**${user.username}**, do you want to remove **${numFmt(cards.length)}** cards from favourites?`,
        onConfirm: async (x) => {
            cards.map(c => {
                 user.cards[user.cards.findIndex(x => x.id == c.id)].fav = false
            })

            user.markModified('cards')
            await user.save()

            return ctx.reply(user, `removed **${numFmt(cards.length)}** cards from favourites`)
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
    list.push(`Cards in pool: **${numFmt(boost.cards.length)}**`)
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

cmd(['wish', 'list'], ['wish', 'ls'], ['wishlist', 'list'], ['wishlist', 'ls'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    if(user.wishlist.length === 0) {
        return ctx.reply(user, `your wishlist is empty. Use \`${ctx.prefix}wish add [card]\` to add cards to your wishlist`)
    }

    cards = cards.filter(x => user.wishlist.some(y => y === x.id))
    if(cards.length === 0) {
        return ctx.reply(user, `there aren't any cards in your wishlist that match this request`, 'red')
    }

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(cards.map(x => `${formatName(x)}`), 15),
        embed: { author: { name: `${user.username}, your wishlist (${numFmt(cards.length)} results)` } }
    })
})).access('dm')

cmd(['wish'], ['wishlist'], ['wish', 'add'], ['wishlist', 'add'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'wishlist')

    if (parsedargs.diff)
        cards = cards.filter(x => !user.cards.some(y => y.id === x.id))

    const card = bestMatch(cards)
    if(user.wishlist.some(x => x === card.id)) {
        return ctx.reply(user, `you already have ${formatName(card)} in your wishlist.
            To remove is use \`${ctx.prefix}wish remove [card]\``, 'red')
    }

    const userHasCard = user.cards.some(x => x.id === card.id)
    user.wishlist.push(card.id)
    await user.save()

    return ctx.reply(user, `added ${formatName(card)} to the wishlist ${userHasCard? '(you own this card)' : ''}`)
})).access('dm')

cmd(['wish', 'add', 'all'], ['wishlist', 'add', 'all'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'wishlist')

    cards = cards.filter(x => !user.wishlist.some(y => y === x.id))

    if (parsedargs.diff)
        cards = cards.filter(x => !user.cards.some(y => y.id === x.id))

    if(cards.length === 0)
        return ctx.reply(user, `all cards from that request are already in your wishlist`, 'red')

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        force: ctx.globals.force,
        question: `**${user.username}**, do you want add **${numFmt(cards.length)}** cards to your wishlist?`,
        onConfirm: async (_x) => {
            cards.map(c => {
                user.wishlist.push(c.id)
            })
            await user.save()

            return ctx.reply(user, `added **${numFmt(cards.length)}** cards to your wishlist`)
        }
    })
})).access('dm')

cmd(['wish', 'rm'], ['wish', 'remove'], ['wishlist', 'remove'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'wishlist')

    if(user.wishlist.length === 0) {
        return ctx.reply(user, `your wishlist is empty. Use \`${ctx.prefix}wish add [card]\` to add cards to your wishlist`, 'red')
    }

    if (parsedargs.diff)
        cards = cards.filter(x => !user.cards.some(y => y.id === x.id))

    const card = bestMatch(cards)
    if(!user.wishlist.some(x => x === card.id)) {
        return ctx.reply(user, `you don't have ${formatName(card)} in your wishlist`, 'red')
    }

    user.wishlist = user.wishlist.filter(x => x != card.id)
    await user.save()

    return ctx.reply(user, `removed ${formatName(card)} from your wishlist`)
})).access('dm')

cmd(['wish', 'rm', 'all'], ['wish', 'remove', 'all'], ['wishlist', 'remove', 'all'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    cards = cards.filter(x => user.wishlist.some(y => y === x.id))

    if(user.wishlist.length === 0) {
        return ctx.reply(user, `your wishlist is empty. Use \`${ctx.prefix}wish add [card]\` to add cards to your wishlist`, 'red')
    }

    if (parsedargs.diff)
        cards = cards.filter(x => !user.cards.some(y => y.id === x.id))

    if(cards.length === 0)
        return ctx.reply(user, `none of the requested cards are in your wishlist`, 'red')

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        force: ctx.globals.force,
        question: `**${user.username}**, do you want remove **${numFmt(cards.length)}** cards from your wishlist?`,
        onConfirm: async (_x) => {
            user.wishlist = user.wishlist.filter(y => !cards.some(c => c.id === y))
            await user.save()

            return ctx.reply(user, `removed **${numFmt(cards.length)}** cards from your wishlist`)
        }
    })
})).access('dm')
