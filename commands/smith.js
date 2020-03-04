const {cmd}     = require('../utils/cmd')
const colors    = require('../utils/colors')
const _         = require('lodash')

const {
    formatName,
    addUserCard,
    withCards,
    withGlobalCards,
    bestMatch,
    removeUserCard,
    withMultiQuery
} = require('../modules/card')

const {
    evalCard, 
    getVialCost 
} = require('../modules/eval')

const {
    addGuildXP,
    getBuilding
} = require('../modules/guild')

const {
    check_effect
} = require('../modules/effect')

cmd(['forge'], withMultiQuery(async (ctx, user, cards, parsedargs) => {
    const hub = getBuilding(ctx, 'smithhub')

    if(!hub)
        return ctx.reply(user, `forging is possible only in the guild with **Smithing Hub level 1+**`, 'red')

    const card1 = bestMatch(cards[0])
    let card2 = bestMatch(cards[1])

    if(!card2 || card1.id === card2.id)
        card2 = bestMatch(cards[0].filter(x => x.id != card1.id))

    if(!card1 || !card2)
        return ctx.reply(user, `not enough cards found matching this query.
            You can specify one query that can get 2+ cards, or 2 queries using \`,\` as separator`, 'red')

    if(card1.level != card2.level)
        return ctx.reply(user, `you can forge only cards of the same star count`, 'red')

    if(card1.level > 3)
        return ctx.reply(user, `you cannot forge cards higher than 3 ${ctx.symbols.star}`, 'red')

    const eval1 = await evalCard(ctx, card1)
    const eval2 = await evalCard(ctx, card2)
    const vialavg = (await getVialCost(ctx, card1, eval1) + await getVialCost(ctx, card2, eval2)) * .5
    const cost = Math.round((eval1 + eval2) * .25)
    const vialres = Math.round(vialavg * .5)

    if(user.exp < cost)
        return ctx.reply(user, `you need at least **${cost}** ${ctx.symbols.tomato} to forge these cards`, 'red')

    const question = `Do you want to forge ${formatName(card1)} and ${formatName(card2)} using **${cost}** ${ctx.symbols.tomato}?
        You will get **${vialres}** ${ctx.symbols.vial} and a **${card1.level} ${ctx.symbols.star} card**`

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question,
        force: ctx.globals.force,
        onConfirm: async (x) => {
            let res = ctx.cards.filter(x => x.level === card1.level && x.id != card1.id && x.id != card2.id)

            if(card1.col === card2.col)
                res = res.filter(x => x.col === card1.col)
            else res = res.filter(x => !ctx.collections.find(y => y.id === x.col).promo)

            const newcard = _.sample(res)
            user.vials += vialres
            user.exp -= cost

            if(!newcard)
                return ctx.reply(user, `an error occured, please try again`, 'red')

            removeUserCard(user, card1.id)
            removeUserCard(user, card2.id)
            addUserCard(user, newcard.id)
            user.lastcard = newcard.id
            user.dailystats[`forge${newcard.level}`] = user.dailystats[`forge${newcard.level}`]++ || 1
            user.markModified('dailystats')
            await user.save()

            return ctx.reply(user, {
                image: { url: newcard.url },
                color: colors.blue,
                description: `you got ${formatName(newcard)}!
                    **${vialres}** ${ctx.symbols.vial} were added to your account`
            })
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

    if(parsedargs.isEmpty())
        return ctx.reply(user, `please specify a card`, 'red')

    if(card.level > 3)
        return ctx.reply(user, `you cannot liquify card higher than 3 ${ctx.symbols.star}`, 'red')

    const usercard = user.cards.find(x => x.id === card.id)
    if(card.level < 3 && check_effect(ctx, user, 'holygrail'))
        vials += vials * .25

    if(usercard.fav && usercard.amount === 1)
        return ctx.reply(user, `you are about to put up last copy of your favourite card for sale. 
            Please, use \`->fav remove ${card.name}\` to remove it from favourites first`, 'yellow')

    const question = `Do you want to liquify ${formatName(card)} into **${vials}** ${ctx.symbols.vial}?
        ${usercard.amount === 1? 'This is the last copy that you have' : `You will have **${usercard.amount}** card(s) left`}`

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question,
        force: ctx.globals.force,
        embed: { footer: { text: `Resulting vials are not constant and can change depending on card popularity` }},
        onConfirm: async (x) => { 
           user.vials += vials
           removeUserCard(user, card.id)
           user.dailystats.liquify = user.dailystats.liquify + 1 || 1
           user.markModified('dailystats')
           await user.save()

           ctx.reply(user, `card ${formatName(card)} was liquified. You got **${vials}** ${ctx.symbols.vial}
               You have **${user.vials}** ${ctx.symbols.vial}
               You can use vials to draw **any 1-3 ${ctx.symbols.star}** card that you want. Use \`->draw\``)
        },
    })
}))

cmd(['draw'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const hub = getBuilding(ctx, 'smithhub')

    if(!hub || hub.level < 2)
        return ctx.reply(user, `drawing cards is possible only in the guild with **Smithing Hub level 2+**`, 'red')

    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'draw')

    const card = bestMatch(cards)
    const vials = await getVialCost(ctx, card)
    const col = ctx.collections.find(x => x.id === card.col)

    if(col.promo)
        return ctx.reply(user, `you cannot draw promo cards`, 'red')

    if(card.level > 3)
        return ctx.reply(user, `you cannot draw card higher than 3 ${ctx.symbols.star}`, 'red')

    if(user.vials < vials)
        return ctx.reply(user, `you don't have enough vials to draw ${formatName(card)}
            You need **${vials}** ${ctx.symbols.vial} but you have **${user.vials}** ${ctx.symbols.vial}`, 'red')

    const question = `Do you want to draw ${formatName(card)} using **${vials}** ${ctx.symbols.vial}?`
    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question,
        force: ctx.globals.force,
        onConfirm: async (x) => {
            user.vials -= vials
            addUserCard(user, card.id)
            user.dailystats.draw = user.dailystats.draw + 1 || 1
            user.markModified('dailystats')
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
