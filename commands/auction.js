const {cmd, pcmd}       = require('../utils/cmd')
const {evalCard}        = require('../modules/eval')
const {Auction}         = require('../collections')
const {addPagination}   = require('../utils/paginator')

const {
    new_auc,
    paginate_auclist
} = require('../modules/auction')

const {
    formatName,
    formatLink,
    equals,
    addUserCard,
    withCards,
    withGlobalCards,
    bestMatch,
    parseArgs,
    filter,
    mapUserCards,
    removeUserCard
} = require('../modules/card')

const {addConfirmation} = require('../utils/confirmator')

cmd('auc', async (ctx, user) => {
    const list = await Auction.find().limit(100).sort({ expires: -1 })

    return await addPagination(ctx, user, 
        `found auctions (${list.length} results)`, 
        paginate_auclist(ctx, user, list))
})

cmd(['auc', 'sell'], withCards(async (ctx, user, cards, parsedargs) => {
    if(user.ban && user.ban.embargo)
        return ctx.reply(user, `you are not allowed to list cards at auction.
                                Your dealings were found to be in violation of our communiy rules.
                                You can inquire further on our [Bot Discord](https://discord.gg/kqgAvdX)`, 'red')

    if(parsedargs.isEmpty())
        return ctx.reply(user, `please specify card`, 'red')

    const card = bestMatch(cards)
    const ceval = await evalCard(ctx, card)
    const price = parsedargs.extra.filter(x => !isNaN(x)).map(x => parseInt(x))[0] || Math.round(ceval)

    const fee = price * .1
    const min = Math.round(ceval * .5)
    const max = Math.round(ceval * 4)

    if(price < min)
        return ctx.reply(user, `you can't set price less than **${min}** {currency} for this card`, 'red')

    if(price > max)
        return ctx.reply(user, `you can't set price higher than **${max}** {currency} for this card`, 'red')

    if(user.exp < fee)
        return ctx.reply(user, `you have to have at least **${fee}** {currency} to auction for that price`, 'red')

    addConfirmation(ctx, user, `Do you want to sell ${formatName(card)} on auction for ${price} {currency}?`, null,
        async (x) => {
        await new_auc(ctx, user, card, price, fee)
    }, async (x) => {
        return ctx.reply(user, `operation was declined`, 'red')
    })
}))

