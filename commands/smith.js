const {cmd}     = require('../utils/cmd')
const {numFmt}  = require('../utils/tools')
const colors    = require('../utils/colors')
const msToTime  = require('pretty-ms')
const _         = require('lodash')

const {
    formatName,
    withCards,
    withGlobalCards,
    bestMatch,
    withMultiQuery,
} = require('../modules/card')

const {
    completed,
} = require('../modules/collection')

const {
    evalCard, 
    getVialCost,
    getVialCostFast,
    getQueueTime,
    evalCardFast,
} = require('../modules/eval')

const {
    check_effect,
} = require('../modules/effect')

const {
    updateUser,
    addUserCards,
    removeUserCards,
    findUserCards,
    getUserCards,
} = require('../modules/user')

const {
    plotPayout,
} = require('../modules/plot')

const {
    withInteraction,
} = require("../modules/interactions")

const {
    getStats,
    saveAndCheck,
    getStaticStats,
} = require("../modules/userstats")

cmd(['forge'], withInteraction(withMultiQuery(async (ctx, user, cards, parsedargs) => {
    if(!parsedargs[0] || parsedargs[0].isEmpty())
        return ctx.qhelp(ctx, user, 'forge')

    const batch1 = cards[0].filter(x => !x.locked)
    const batch2 = cards[1]?.filter(x => !x.locked)


    let card1, card2

    if(!batch1 || batch1.length == 0) {
        return ctx.reply(user, `couldn't find any matching cards`, 'red')
    }

    card1 = batch1[0]

    if(batch2 && batch2.length > 0) {
        card2 = batch2.filter(x => x.id != card1.id)[0]
    } else {
        card2 = batch1.filter(x => x.id != card1.id)[0]
    }

    if(!card1 || !card2)
        return ctx.reply(user, `not enough unique cards found matching this query.
            You can specify one query that can get 2+ unique cards, or 2 queries using \`,\` as separator`, 'red')

    if(card1.level != card2.level)
        return ctx.reply(user, `you can forge only cards of the same star count`, 'red')

    if(card1.level > 3)
        return ctx.reply(user, `you cannot forge cards higher than 3 ${ctx.symbols.star}`, 'red')

    const eval1 = await evalCard(ctx, card1)
    const eval2 = await evalCard(ctx, card2)
    const vialavg = (await getVialCost(ctx, card1, eval1) + await getVialCost(ctx, card2, eval2)) * .5
    const cost = Math.round(((eval1 + eval2) * .25) * (await check_effect(ctx, user, 'cherrybloss')? .5 : 1))
    const vialres = Math.round((vialavg === Infinity? 0 : vialavg) * .5)

    if(user.exp < cost)
        return ctx.reply(user, `you need at least **${numFmt(cost)}** ${ctx.symbols.tomato} to forge these cards`, 'red')

    if((card1.fav && card1.amount == 1) || (card2.fav && card2.amount == 1))
        return ctx.reply(user, `your query contains last copy of your favourite card(s). Please remove it from favourites and try again`, 'red')

    const question = `Do you want to forge ${formatName(card1)}**(x${card1.amount})** and ${formatName(card2)}**(x${card2.amount})** using **${numFmt(cost)}** ${ctx.symbols.tomato}?
        You will get **${numFmt(vialres)}** ${ctx.symbols.vial} and a **${card1.level} ${ctx.symbols.star} card**`

    return ctx.sendCfm(ctx, user, {
        question,
        force: ctx.globals.force,
        onConfirm: async (x) => {
            try {
                let res = ctx.cards.filter(x => x.level === card1.level && x.id != card1.id && x.id != card2.id)

                if(card1.col === card2.col)
                    res = res.filter(x => x.col === card1.col)
                else res = res.filter(x => !ctx.collections.find(y => y.id === x.col).promo)

                const newcard = _.sample(res)
                user.vials += vialres
                user.exp -= cost

                let stats = await getStats(ctx, user, user.lastdaily)
                stats.forge += 1
                stats[`forge${card1.level}`] += 1
                stats.tomatoout += cost
                stats.vialin += vialres


                if(!newcard)
                    return ctx.reply(user, `an error occured, please try again`, 'red')

                await removeUserCards(ctx, user, [card1.id, card2.id])


                await addUserCards(ctx, user, [newcard.id])
                user.lastcard = newcard.id
                await completed(ctx, user, [card1.id, card2.id, newcard.id])
                await user.save()
                await saveAndCheck(ctx, user, stats)
                await evalCard(ctx, newcard)

                await plotPayout(ctx, 'smithhub', 1, 10)

                const usercards = await findUserCards(ctx, user, [newcard.id])
                    .select('amount')
                    
                return ctx.reply(user, {
                    image: { url: newcard.url },
                    color: colors.blue,
                    description: `you got ${formatName(newcard)}!
                        **${numFmt(vialres)}** ${ctx.symbols.vial} were added to your account
                        ${usercards[0].amount > 1 ? `*You already have this card*` : ''}`
                }, 'green', true)
            } catch(e) {
                return ctx.reply(user, `an error occured while executing this command. 
                    Please try again`, 'red', true)
            }
        }
    }, false)
})))

cmd(['liquefy', 'one'], withInteraction(withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'liq')

    const card = cards.filter(x => !x.locked)[0]
    if (!card)
        return ctx.reply(user, `no card found to liquefy!`, 'red')
    let vials = Math.round((await getVialCost(ctx, card)) * .25)
    if(vials === Infinity)
        vials = 5

    if(card.level > 3)
        return ctx.reply(user, `you cannot liquefy card higher than 3 ${ctx.symbols.star}`, 'red')

    if(card.level < 3 && await check_effect(ctx, user, 'holygrail'))
        vials += vials * .25

    if(card.fav && card.amount === 1)
        return ctx.reply(user, `you are about to liquefy the last copy of a favorite card. 
            Please, use \`${ctx.prefix}fav remove one\` to remove it from favourites first`, 'yellow')

    const question = `Do you want to liquefy ${formatName(card)} into **${numFmt(vials)}** ${ctx.symbols.vial}?
        ${card.amount === 1? 'This is the last copy that you have' : `You will have **${card.amount - 1}** card(s) left`}`

    return ctx.sendCfm(ctx, user, {
        question,
        force: ctx.globals.force,
        embed: { footer: { text: `Resulting vials are not constant and can change depending on card popularity` }},
        onConfirm: async (x) => { 
            try {
                let stats = await getStats(ctx, user, user.lastdaily)
                stats.liquefy += 1
                stats[`liquefy${card.level}`] += 1
                stats.vialin += vials
                user.vials += vials

                await removeUserCards(ctx, user, [card.id])
                await completed(ctx, user, [card.id])
                await user.save()
                await saveAndCheck(ctx, user, stats)

                await plotPayout(ctx, 'smithhub', 2, 15)

                ctx.reply(user, `card ${formatName(card)} was liquefied. You got **${numFmt(vials)}** ${ctx.symbols.vial}
                    You have **${numFmt(user.vials)}** ${ctx.symbols.vial}
                    You can use vials to draw **any 1-3 ${ctx.symbols.star}** card that you want. Use \`${ctx.prefix}draw\``, 'green', true)
            } catch(e) {
                return ctx.reply(user, `an error occured while executing this command. 
                    Please try again`, 'red', true)
            }
        },
    }, false)
})))

cmd(['liquefy', 'many'], withInteraction(withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'liq')

    cards = cards.filter(x => !x.locked)
    cards.splice(parsedargs.count || 100, cards.length)
    
    if(cards.some(x => x.level > 3))
        return ctx.reply(user, `you cannot liquefy cards higher than 3 ${ctx.symbols.star}`, 'red')
    
    if(cards.some(x => x.fav && x.amount === 1))
        return ctx.reply(user, `you are about to liquefy the last copy of your favourite card. 
            Please, use \`${ctx.prefix}liquefy many card_query:!fav\` to include only non-favourite cards.`, 'yellow')

    let vials = 0
    const hasGrail = await check_effect(ctx, user, 'holygrail')
    cards.forEach(card => {
        let cost = getVialCostFast(ctx, card)
        if(cost >= 0) {
            if(cost === Infinity)
                cost = 5

            if(card.level < 3 && hasGrail)
                cost += cost * .25

            cost = Math.round(cost * .25)
            vials += cost
        } else {
            vials = NaN
        }
    })

    if(isNaN(vials)) {
        const evalTime = getQueueTime()
        return ctx.reply(user, `some cards from this request need price evaluation.
            Please try again in **${msToTime(evalTime)}**.`, 'yellow')
    }

    const question = `Do you want to liquefy **${cards.length} card(s)** into **${numFmt(vials)}** ${ctx.symbols.vial}?`

    return ctx.sendCfmPgn(ctx, user, {
        pages: ctx.pgn.getPages(cards.map(card => formatName(card)), 10),
        embed: {
            title: question,
            footer: { text: `Resulting vials are not constant and can change depending on card popularity` }
        },
        force: ctx.globals.force,
        buttons: ['first', 'back', 'forward', 'last', 'confirm', 'decline'],
        question,
        switchPage: (data) => {
            const page = data.pages[data.pagenum]
            data.embed.description = data.pages[data.pagenum]
            data.embed.footer = {text: `${data.pagenum + 1}/${data.pages.length} || Resulting vials are not constant and can change depending on card popularity`}
        },
        onConfirm: async (x) => {
            try {
                const cardCount = cards.length
                const lemons = 15 * cardCount
                let stats = await getStats(ctx, user, user.lastdaily)

                user.vials += vials
                stats.liquefy += cardCount
                stats.vialin += vials

                cards.map(c => {
                    stats[`liquefy${c.level}`]++
                })

                await saveAndCheck(ctx, user, stats)
                await removeUserCards(ctx, user, cards.map(x => x.id))
                await user.save()
                await plotPayout(ctx, 'smithhub', 2, lemons)

                ctx.reply(user, `${cardCount} cards were liquefied. You got **${numFmt(vials)}** ${ctx.symbols.vial}
                    You have **${numFmt(user.vials)}** ${ctx.symbols.vial}
                    You can use vials to draw **any 1-3 ${ctx.symbols.star}** card that you want. Use \`${ctx.prefix}draw\``, 'green', true)
            } catch(e) {
                return ctx.reply(user, `an error occurred while executing this command. 
                    Please try again`, 'red', true)
            }
        }
    })
})))

cmd(['liquefy', 'preview'], withInteraction(withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'liq')

    cards = cards.filter(x => !x.locked)
    cards.splice(100, cards.length)
    
    if(cards.some(x => x.level > 3))
        return ctx.reply(user, `you cannot liquefy cards higher than 3 ${ctx.symbols.star}`, 'red')

    let vials = 0
    const hasGrail = await check_effect(ctx, user, 'holygrail')
    const resp = cards.map(card => {
        let cost = getVialCostFast(ctx, card)
        if(cost >= 0) {
            if(cost === Infinity)
                cost = 5

            if(card.level < 3 && hasGrail)
                cost += cost * .25

            cost = Math.round(cost * .25)
            vials += cost
        } else {
            vials = NaN
        }

        return {
            cost,
            cardname: `**${numFmt(cost)}** ${ctx.symbols.vial} - ${formatName(card)}`,
        }
    })

    if(isNaN(vials)) {
        const evalTime = getQueueTime()
        return ctx.reply(user, `some cards from this request need price evaluation.
            Please try again in **${msToTime(evalTime)}**.`, 'yellow')
    }

    resp.sort((a, b) => b.cost - a.cost)

    return ctx.sendPgn(ctx, user, {
        pages: ctx.pgn.getPages(resp.map(x => x.cardname), 10),
        embed: {
            author: { name: `Liquefy preview (total ${numFmt(vials)} ${ctx.symbols.vial})` },
            description: '',
            color: colors.blue,
        }
    })
})))

cmd(['draw'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'draw')

    const userCards = await getUserCards(ctx, user)
    if (parsedargs.diff)
        cards = cards.filter(x => parsedargs.diff == 1 ^ userCards.some(y => y.cardid === x.id))

    let staticStats = await getStaticStats(ctx, user, user.lastdaily)

    const amount = staticStats.draw || 0
    cards = cards.filter(x => {
        const eval = evalCardFast(ctx, x)
        if (eval > 0 && eval != 'Infinity')
            return x
        return 0
    })
    const card = bestMatch(cards)

    if (!card)
        return ctx.reply(user, `no cards found matching \`${parsedargs.cardQuery}\` that can be drawn!`, 'red')

    const cost = await getVialCost(ctx, card)
    let extra = Math.floor(cost * .2 * amount)
    if (amount >= 10)
        extra = Math.floor(cost * (2 ** amount / 100))
    const vials = cost + extra
    const col = ctx.collections.find(x => x.id === card.col)

    if (cost == 'Infinity')
        return ctx.reply(user, 'impossible to draw until someone claims this card!', 'red')
    
    if(col.promo)
        return ctx.reply(user, `you cannot draw promo cards`, 'red')

    if(card.level > 3)
        return ctx.reply(user, `you cannot draw cards higher than 3 ${ctx.symbols.star}`, 'red')

    if(user.vials < vials)
        return ctx.reply(user, `you don't have enough vials to draw ${formatName(card)}
            You need **${numFmt(vials)}** ${ctx.symbols.vial} (+**${numFmt(extra)}**) but you have **${numFmt(user.vials)}** ${ctx.symbols.vial}
            Liquefy some cards with \`${ctx.prefix}liquefy\` to get vials!`, 'red')

    let question = `Do you want to draw ${formatName(card)} using **${numFmt(vials)}** ${ctx.symbols.vial}?`
    if(amount > 0) {
        question += `\n(+**${numFmt(extra)}** for your #${amount + 1} draw today)`
    }

    return ctx.sendCfm(ctx, user, {
        question,
        force: ctx.globals.force,
        onConfirm: async (x) => {
            user.vials -= vials
            await addUserCards(ctx, user, [card.id])

            user.lastcard = card.id
            await completed(ctx, user, [card.id])
            await user.save()

            await plotPayout(ctx, 'smithhub', 3, 20)

            let stats = await getStats(ctx, user, user.lastdaily)
            stats.draw += 1
            stats[`draw${card.level}`] += 1
            stats.vialout += vials
            await saveAndCheck(ctx, user, stats)
            return ctx.reply(user, {
                image: { url: card.url },
                color: colors.blue,
                description: `you got ${formatName(card)}!
                    You have **${numFmt(user.vials)}** ${ctx.symbols.vial} remaining`
            }, 'green', true)
        }
    })
})))
