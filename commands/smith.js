const {cmd}     = require('../utils/cmd')
const colors    = require('../utils/colors')

const {
    formatName,
    addUserCard,
    withCards,
    withGlobalCards,
    bestMatch,
    removeUserCard
} = require('../modules/card')

const { getVialCost }   = require('../modules/eval')
const {addConfirmation} = require('../utils/confirmator')

cmd(['forge'], (ctx, user, ...args) => {
    const argsplit = args.join(' ').split(',')
})

cmd(['liq'], withCards(async (ctx, user, cards, parsedargs) => {
    const card = bestMatch(cards)
    const vials = Math.round((await getVialCost(ctx, card)) * .7)

    if(card.level > 3)
        return ctx.reply(user, `you cannot liquify card higher than 3 ${ctx.symbols.star}`, 'red')

    addConfirmation(ctx, user, 
        `Do you want to liquify ${formatName(card)} into **${vials}** ${ctx.symbols.vial}?`, null, 
        async (x) => {
            user.vials += vials
            removeUserCard(user, card.id)
            await user.save()

            ctx.reply(user, `card ${formatName(card)} was liquified. You got **${vials}** ${ctx.symbols.vial}
                You have **${user.vials}** ${ctx.symbols.vial}
                You can use vials to draw **any 1-3 ${ctx.symbols.star}** card that you want. Use \`->draw\``)
        }, 
        (x) => ctx.reply(user, `liquifying operation was declined`, 'red'), 
        `Resulting vials are not constant and can change depending on card popularity`)
}))

cmd(['draw'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const card = bestMatch(cards)
    const vials = await getVialCost(ctx, card)

    if(card.level > 3)
        return ctx.reply(user, `you cannot draw card higher than 3 ${ctx.symbols.star}`, 'red')

    if(user.vials < vials)
        return ctx.reply(user, `you don't have enough vials to draw ${formatName(card)}
            You need **${vials}** ${ctx.symbols.vial} but you have **${user.vials}** ${ctx.symbols.vial}`, 'red')

    addConfirmation(ctx, user, 
        `Do you want to draw ${formatName(card)} using **${vials}** ${ctx.symbols.vial}?`, null, 
        async (x) => {
            user.vials -= vials
            addUserCard(user, card.id)
            await user.save()

            return ctx.reply(user, {
                image: { url: card.url },
                color: colors.blue,
                description: `you got ${formatName(card)}!
                    You have **${user.vials}** ${ctx.symbols.vial} remaining`
            })
        }, 
        (x) => ctx.reply(user, `card draw was declined`, 'red'))
}))