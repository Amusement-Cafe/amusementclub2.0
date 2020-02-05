const {cmd, pcmd}       = require('../utils/cmd')
const {evalCard}        = require('../modules/eval')
const {Auction}         = require('../collections')
const {addPagination}   = require('../utils/paginator')
const {fetchOnly}       = require('../modules/user')
const msToTime          = require('pretty-ms')
const colors            = require('../utils/colors')
const asdate            = require('add-subtract-date')

const {
    new_auc,
    paginate_auclist,
    bid_auc
} = require('../modules/auction')

const {
    formatName,
    withCards,
    bestMatch,
    withGlobalCards
} = require('../modules/card')

const {
    addGuildXP,
    getBuilding
} = require('../modules/guild')

const {addConfirmation} = require('../utils/confirmator')

cmd('auc', withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const now = new Date();
    const req = {finished: false}

    if(parsedargs.me)
        req.author = user.discord_id

    let list = (await Auction.find(req).limit(100).sort({ expires: 1 }))
        .filter(x => x.expires > now)

    if(parsedargs.diff)
        list = list.filter(x => !user.cards.filter(y => x.card === y.id)[0])

    if(!parsedargs.isEmpty())
        list = list.filter(x => cards.filter(y => x.card === y.id)[0])

    if(list.length === 0)
        return ctx.reply(user, `found 0 active auctions`, 'red')

    return await addPagination(ctx, user, 
        `found auctions (${list.length} results)`, 
        paginate_auclist(ctx, user, list))
})).access('dm')

cmd(['auc', 'info'], async (ctx, user, arg1) => {
    const auc = await Auction.findOne({ id: arg1 })

    if(!auc)
        return ctx.reply(user, `auction with ID \`${arg1}\` was not found`, 'red')

    const author = await fetchOnly(auc.author)
    const card = ctx.cards[auc.card]
    const timediff = msToTime(auc.expires - new Date(), {compact: true})

    const resp = []
    resp.push(`Seller: **${author.username}**`)
    resp.push(`Price: **${auc.price}** ${ctx.symbols.tomato}`)
    resp.push(`Card: ${formatName(card)}`)
    resp.push(`Card value: **${await evalCard(ctx, card)}** ${ctx.symbols.tomato}`)

    if(auc.finished)
        resp.push(`**This auction has finished**`)
    else
        resp.push(`Expires in **${timediff}**`)

    return ctx.send(ctx.msg.channel.id, {
        title: `Auction [${auc.id}]`,
        image: { url: card.url },
        description: resp.join('\n'),
        color: colors['blue']
    }, user.discord_id)
}).access('dm')

cmd(['auc', 'sell'], withCards(async (ctx, user, cards, parsedargs) => {
    const auchouse = getBuilding(ctx, 'auchouse')
    if(!auchouse || auchouse.health < 50)
        return ctx.reply(user, `you can sell cards only in a guild that has **Auction House** level 1 or higher with health over **50%**!`, 'red')

    if(user.ban && user.ban.embargo)
        return ctx.reply(user, `you are not allowed to list cards at auction.
                                Your dealings were found to be in violation of our community rules.
                                You can inquire further on our [Bot Discord](https://discord.gg/kqgAvdX)`, 'red')

    if(parsedargs.isEmpty())
        return ctx.reply(user, `please specify card`, 'red')

    const card = bestMatch(cards)
    const ceval = await evalCard(ctx, card)
    const usercard = user.cards.filter(x => x.id === card.id)[0]
    const price = parsedargs.extra.filter(x => !isNaN(x) && parseInt(x) > 0).map(x => parseInt(x))[0] || Math.round(ceval)

    const fee = Math.round(auchouse.level > 1? price * .05 : price * .1)
    const min = Math.round(ceval * .5)
    const max = Math.round(ceval * 4)
    const timenum = -parsedargs.extra.filter(x => x[0] === '-').map(x => parseInt(x))[0]
    let time = 6

    if(timenum) {
        if(auchouse.level < 3)
            return ctx.reply(user, `you can specify auction time only in a guild that has **Auction House** level 3 or higher!`, 'red')

        time = Math.min(Math.max(timenum, 1), 10);
    }

    if(price < min)
        return ctx.reply(user, `you can't set price less than **${min}** ${ctx.symbols.tomato} for this card`, 'red')

    if(price > max)
        return ctx.reply(user, `you can't set price higher than **${max}** ${ctx.symbols.tomato} for this card`, 'red')

    if(user.exp < fee)
        return ctx.reply(user, `you have to have at least **${fee}** ${ctx.symbols.tomato} to auction for that price`, 'red')

    if(usercard.fav && usercard.amount === 1)
        return ctx.reply(user, `you are about to put up last copy of your favourite card for sale. 
            Please, use \`->fav remove ${card.name}\` to remove it from favourites first`, 'yellow')

    addConfirmation(ctx, user, `Do you want to sell ${formatName(card)} on auction for ${price} ${ctx.symbols.tomato}? 
        ${timenum? `This auction will last **${time} hours**` : ''}
        ${card.amount > 1? '' : 'This is the only copy that you have, so your rating will be lost'}`, null,
        async (x) => {
        await new_auc(ctx, user, card, price, fee, time)
    }, async (x) => {
        return ctx.reply(user, `operation was declined`, 'red')
    }, `This will cost ${fee} (${auchouse.level > 1? 5 : 10}% fee)`)
}))

cmd(['auc', 'bid'], 'bid', async (ctx, user, ...args) => {
    if(user.ban && user.ban.embargo)
        return ctx.reply(user, `you are not allowed to list cards at auction.
                                Your dealings were found to be in violation of our community rules.
                                You can inquire further on our [Bot Discord](https://discord.gg/kqgAvdX)`, 'red')

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
        return ctx.reply(user, `you don't have \`${bid}\` ${ctx.symbols.tomato} to bid`, 'red')        

    if(auc.expires < now || auc.finished)
        return ctx.reply(user, `auction \`${auc.id}\` already finished`, 'red')

    if(auc.author === user.discord_id)
        return ctx.reply(user, `you cannot bid on your own auction`, 'red')

    if(auc.price >= bid)
        return ctx.reply(user, `your bid should be higher than **${auc.price}** ${ctx.symbols.tomato}`, 'red')

    if(auc.lastbidder === user.discord_id)
        return ctx.reply(user, `you already have the highest bid on this auction`, 'red')

    await bid_auc(ctx, user, auc, bid)
}).access('dm')

cmd(['auc', 'cancel'], async (ctx, user, arg1) => {
    let auc = await Auction.findOne({ id: arg1 })
    const card = ctx.cards[auc.card]

    if(!auc)
        return ctx.reply(user, `auction with ID \`${arg1}\` was not found`, 'red')

    if(auc.author != user.discord_id)
        return ctx.reply(user, `you don't have rights to cancel this auction`, 'red')

    if(auc.lastbidder)
        return ctx.reply(user, `you cannot cancel this auction. A person has already bid on it`, 'red')

    if(auc.expires < asdate.add(new Date(), 1, 'hour'))
        return ctx.reply(user, `you cannot cancel auction that expires in less than one hour`, 'red')

    addConfirmation(ctx, user, `Do you want to cancel auction \`${auc.id}\` for ${formatName(card)}?`, null,
        async (x) => {
        
        auc = await Auction.findOne({ id: arg1 })
        if(auc.lastbidder)
            return ctx.reply(user, `you cannot cancel this auction. A person has already bid on it`, 'red')

        auc.expires = new Date(0)
        await auc.save()

        return ctx.reply(user, `auction \`${auc.id}\` was marked for expiration. You will get your card back soon`)

    }, (x) => {
        return ctx.reply(user, `operation was declined`, 'red')
    }, `You won't get a fee refund`)
}).access('dm')
