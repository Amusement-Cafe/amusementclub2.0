const {cmd}     = require('../utils/cmd')
const colors    = require('../utils/colors')
const msToTime  = require('pretty-ms')
const _         = require('lodash')

const {
    formatName,
    addUserCard,
    withCards,
    withGlobalCards,
    bestMatch,
    removeUserCard,
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
} = require('../modules/eval')

const {
    getBuilding,
} = require('../modules/guild')

const {
    check_effect,
} = require('../modules/effect')

const {
    updateUser,
} = require('../modules/user')

cmd(['forge'], withMultiQuery(async (ctx, user, cards, parsedargs) => {
    const hub = getBuilding(ctx, 'smithhub')

    if(!hub)
        return ctx.reply(user, `forging is possible only in the guild with **Smithing Hub level 1+**. Buy one in the \`->store\``, 'red')

    const batch1 = cards[0]
    const batch2 = cards[1]

    let card1, card2

    if(!batch1 || batch1.length == 0) {
        return ctx.reply(user, `couldn't find any matching cards`, 'red')
    }

    card1 = batch1[0]

    if(batch2 && batch2.length > 0) {
        card2 = batch2[0]
    } else {
        card2 = batch1.filter(x => x.id != card1.id)[0]
    }

    if(!card1 || !card2)
        return ctx.reply(user, `not enough cards found matching this query.
            You can specify one query that can get 2+ unique cards, or 2 queries using \`,\` as separator`, 'red')

    if(card1.level != card2.level)
        return ctx.reply(user, `you can forge only cards of the same star count`, 'red')

    if(card1.level > 3)
        return ctx.reply(user, `you cannot forge cards higher than 3 ${ctx.symbols.star}`, 'red')

    const eval1 = await evalCard(ctx, card1)
    const eval2 = await evalCard(ctx, card2)
    const vialavg = (await getVialCost(ctx, card1, eval1) + await getVialCost(ctx, card2, eval2)) * .5
    const cost = Math.round(((eval1 + eval2) * .25) * (check_effect(ctx, user, 'cherrybloss')? .5 : 1))
    const vialres = Math.round((vialavg === Infinity? 0 : vialavg) * .5)

    if(user.exp < cost)
        return ctx.reply(user, `you need at least **${cost}** ${ctx.symbols.tomato} to forge these cards`, 'red')

    if((card1.fav && card1.amount == 1) || (card2.fav && card2.amount == 1))
        return ctx.reply(user, `your query contains last copy of your favourite card(s). Please remove it from favourites and try again`, 'red')

    const question = `Do you want to forge ${formatName(card1)}**(x${card1.amount})** and ${formatName(card2)}**(x${card2.amount})** using **${cost}** ${ctx.symbols.tomato}?
        You will get **${vialres}** ${ctx.symbols.vial} and a **${card1.level} ${ctx.symbols.star} card**`

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
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

                if(!newcard)
                    return ctx.reply(user, `an error occured, please try again`, 'red')

                removeUserCard(ctx, user, card1.id)
                removeUserCard(ctx, user, card2.id)
                await user.save()

                addUserCard(user, newcard.id)
                user.lastcard = newcard.id
                user.dailystats[`forge${newcard.level}`] = user.dailystats[`forge${newcard.level}`] + 1 || 1
                user.markModified('dailystats')
                await completed(ctx, user, newcard)
                await user.save()

                const usercard = user.cards.find(x => x.id === newcard.id)
                return ctx.reply(user, {
                    image: { url: newcard.url },
                    color: colors.blue,
                    description: `you got ${formatName(newcard)}!
                        **${vialres}** ${ctx.symbols.vial} were added to your account
                        ${usercard.amount > 1 ? `*You already have this card*` : ''}`
                })
            } catch(e) {
                return ctx.reply(user, `an error occured while executing this command. 
                    Please try again`, 'red')
            }
        }
    })
}))

cmd('liq', 'liquify', withCards(async (ctx, user, cards, parsedargs) => {
    const hub = getBuilding(ctx, 'smithhub')

    if(!hub || hub.level < 2)
        return ctx.reply(user, `liquifying is possible only in the guild with **Smithing Hub level 2+**`, 'red')

    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'liq')

    const card = bestMatch(cards)
    let vials = Math.round((await getVialCost(ctx, card)) * .25)
    if(vials === Infinity)
        vials = 5

    if(card.level > 3)
        return ctx.reply(user, `you cannot liquify card higher than 3 ${ctx.symbols.star}`, 'red')

    if(card.level < 3 && check_effect(ctx, user, 'holygrail'))
        vials += vials * .25

    if(card.fav && card.amount === 1)
        return ctx.reply(user, `you are about to put up last copy of your favourite card for sale. 
            Please, use \`->fav remove ${card.name}\` to remove it from favourites first`, 'yellow')

    const question = `Do you want to liquify ${formatName(card)} into **${vials}** ${ctx.symbols.vial}?
        ${card.amount === 1? 'This is the last copy that you have' : `You will have **${card.amount - 1}** card(s) left`}`

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question,
        force: ctx.globals.force,
        embed: { footer: { text: `Resulting vials are not constant and can change depending on card popularity` }},
        onConfirm: async (x) => { 
            try {
                user.vials += vials
                user.dailystats.liquify = user.dailystats.liquify + 1 || 1
                user.dailystats[`liquify${card.level}`] += 1
                removeUserCard(ctx, user, card.id)
                await user.save()

                ctx.reply(user, `card ${formatName(card)} was liquified. You got **${vials}** ${ctx.symbols.vial}
                    You have **${user.vials}** ${ctx.symbols.vial}
                    You can use vials to draw **any 1-3 ${ctx.symbols.star}** card that you want. Use \`->draw\``)
            } catch(e) {
                return ctx.reply(user, `an error occured while executing this command. 
                    Please try again`, 'red')
            }
        },
    })
}))

cmd(['liq', 'all'], ['liquify', 'all'], withCards(async (ctx, user, cards, parsedargs) => {
    const hub = getBuilding(ctx, 'smithhub')

    //if(!hub || hub.level < 2)
        //return ctx.reply(user, `liquifying is possible only in the guild with **Smithing Hub level 2+**`, 'red')

    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'liq')

    cards.splice(25, cards.length)
    
    if(cards.some(x => x.level > 3))
        return ctx.reply(user, `you cannot liquify cards higher than 3 ${ctx.symbols.star}`, 'red')
    
    if(cards.some(x => x.fav && x.amount === 1))
        return ctx.reply(user, `you are about to liquify the last copy of your favourite card. 
            Please, use \`->liq all !fav\` to include only non-favourite cards.`, 'yellow')

    let vials = 0
    cards.forEach(card => {
        let cost = getVialCostFast(ctx, card)
        if(cost >= 0) {
            if(cost === Infinity)
                cost = 5

            if(card.level < 3 && check_effect(ctx, user, 'holygrail'))
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

    const question = `Do you want to liquify **${cards.length} card(s)** into **${vials}** ${ctx.symbols.vial}?
        To view cards that are going to be liquified, use \`->liq preview [query]\``

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question,
        force: ctx.globals.force,
        embed: { footer: { text: `Resulting vials are not constant and can change depending on card popularity` }},
        onConfirm: async (x) => { 
            try {
                user.vials += vials

                cards.map(c => {
                    removeUserCard(ctx, user, c.id)
                    user.dailystats.liquify += 1
                    user.dailystats[`liquify${c.level}`] += 1
                })
                await user.save()

                ctx.reply(user, `${cards.length} cards were liquified. You got **${vials}** ${ctx.symbols.vial}
                    You have **${user.vials}** ${ctx.symbols.vial}
                    You can use vials to draw **any 1-3 ${ctx.symbols.star}** card that you want. Use \`->draw\``)
            } catch(e) {
                return ctx.reply(user, `an error occured while executing this command. 
                    Please try again`, 'red')
            }
        },
    })
}))

cmd(['liq', 'preview'], ['liquify', 'preview'], withCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'liq')

    cards.splice(25, cards.length)
    
    if(cards.some(x => x.level > 3))
        return ctx.reply(user, `you cannot liquify cards higher than 3 ${ctx.symbols.star}`, 'red')

    let vials = 0
    const resp = cards.map(card => {
        let cost = getVialCostFast(ctx, card)
        if(cost >= 0) {
            if(cost === Infinity)
                cost = 5

            if(card.level < 3 && check_effect(ctx, user, 'holygrail'))
                cost += cost * .25

            cost = Math.round(cost * .25)
            vials += cost
        } else {
            vials = NaN
        }

        return {
            cost,
            cardname: `**${cost}** ${ctx.symbols.vial} - ${formatName(card)}`,
        }
    })

    if(isNaN(vials)) {
        const evalTime = getQueueTime()
        return ctx.reply(user, `some cards from this request need price evaluation.
            Please try again in **${msToTime(evalTime)}**.`, 'yellow')
    }

    resp.sort((a, b) => b.cost - a.cost)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(resp.map(x => x.cardname), 10),
        embed: {
            author: { name: `Liquify preview (total ${vials} ${ctx.symbols.vial})` },
            description: '',
            color: colors.blue,
        }
    })
}))

cmd(['draw'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const hub = getBuilding(ctx, 'smithhub')

    if(!hub || hub.level < 2)
        return ctx.reply(user, `drawing cards is possible only in the guild with **Smithing Hub level 2+**`, 'red')

    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'draw')

    const amount = user.dailystats.draw || 0
    const card = bestMatch(cards)
    const cost = await getVialCost(ctx, card)
    const extra = Math.floor(cost * .2 * amount)
    const vials = cost + extra
    const col = ctx.collections.find(x => x.id === card.col)

    if (cost == 'Infinity')
        return ctx.reply(user, 'impossible to draw until someone claims this card!', 'red')
    
    if(col.promo)
        return ctx.reply(user, `you cannot draw promo cards`, 'red')

    if(card.level > 3)
        return ctx.reply(user, `you cannot draw card higher than 3 ${ctx.symbols.star}`, 'red')

    if(user.vials < vials)
        return ctx.reply(user, `you don't have enough vials to draw ${formatName(card)}
            You need **${vials}** ${ctx.symbols.vial} (+**${extra}**) but you have **${user.vials}** ${ctx.symbols.vial}`, 'red')

    let question = `Do you want to draw ${formatName(card)} using **${vials}** ${ctx.symbols.vial}?`
    if(amount > 0) {
        question += `\n(+**${extra}** for your #${amount + 1} draw today)`
    }

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question,
        force: ctx.globals.force,
        onConfirm: async (x) => {
            user.vials -= vials
            addUserCard(user, card.id)
            user.lastcard = card.id
            await completed(ctx, user, card)
            user.dailystats.draw += 1
            user.dailystats[`draw${card.level}`] += 1
            await user.save()

            return ctx.reply(user, {
                image: { url: card.url },
                color: colors.blue,
                description: `you got ${formatName(card)}!
                    You have **${user.vials}** ${ctx.symbols.vial} remaining`
            })
        }
    })
}))
