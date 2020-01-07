const {cmd, pcmd}       = require('../utils/cmd')
const {evalCard}        = require('../modules/eval')
const {Auction}         = require('../collections')
const {addPagination}   = require('../utils/paginator')

const {
    new_auc,
    paginate_auclist,
    bid_auc
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
    const now = new Date();
    const list = (await Auction.find({finished: false}).limit(100).sort({ expires: -1 }))
        .filter(x => x.expires > now)

    if(list.length === 0)
        return ctx.reply(user, `found 0 active auctions`, 'red')

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

cmd(['auc', 'bid'], 'bid', async (ctx, user, ...args) => {
    const now = new Date();
    const bid = parseInt(args.filter(x => !isNaN(x))[0])
    const id = args.filter(x => isNaN(x))[0]

    if(!id)
        return ctx.reply(user, `please specify auction ID`, 'red')

    if(!bid)
        return ctx.reply(user, `please bid amount`, 'red')

    const auc = await Auction.findOne({id: id})

    if(!auc)
        return ctx.reply(user, `auction with ID \`${id}\` wasn't found`, 'red')

    if(user.exp < bid)
        return ctx.reply(user, `you don't have \`${bid}\` {currency} to bid`, 'red')        

    if(auc.expires < now || auc.finished)
        return ctx.reply(user, `auction \`${auc.id}\` already finished`, 'red')

    if(auc.author === user.discord_id)
        return ctx.reply(user, `you cannot bid on your own auction`, 'red')

    if(auc.price >= bid)
        return ctx.reply(user, `you bid should be higher than ${auc.price}`, 'red')

    await bid_auc(ctx, user, auc, bid)
})