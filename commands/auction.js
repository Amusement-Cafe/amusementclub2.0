const {cmd}             = require('../utils/cmd')
const {numFmt}          = require('../utils/tools')
const {evalCard}        = require('../modules/eval')
const {fetchOnly}       = require('../modules/user')
const msToTime          = require('pretty-ms')
const colors            = require('../utils/colors')
const asdate            = require('add-subtract-date')

const {
    Auction,
    User,
} = require('../collections')

const {
    new_auc,
    paginate_auclist,
    bid_auc,
    format_auc,
} = require('../modules/auction')

const {
    formatName,
    withCards,
    bestMatch,
    withGlobalCards,
} = require('../modules/card')

cmd('auc', 'auction', 'auctions', withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const now = new Date();
    const req = {finished: false}

    if(parsedargs.me === 1)
        req.author = user.discord_id

    let list = (await Auction.find(req).sort({ expires: 1 }))
        .filter(x => x.expires > now)

    if (parsedargs.me === 2)
        list = list.filter(x => x.author !== user.discord_id)

    if (parsedargs.diff)
        list = list.filter(x => parsedargs.diff == 1 ^ user.cards.some(y => y.id === x.card))

    if(parsedargs.bid === 1)
        list = list.filter(x => x.lastbidder && x.lastbidder === user.discord_id)
    else if(parsedargs.bid === 2) 
        list = list.filter(x => !x.lastbidder || x.lastbidder != user.discord_id)

    if(!parsedargs.isEmpty())
        list = list.filter(x => cards.some(y => x.card === y.id))

    if(list.length === 0)
        return ctx.reply(user, `found 0 active auctions`, 'red')

    list = list.slice(0, 100)

    return ctx.sendPgn(ctx, user, {
        pages: paginate_auclist(ctx, user, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, found auctions (${list.length} results)` },
            color: colors.blue,
        }
    })
})).access('dm')

cmd(['auc', 'info'], ['auction', 'info'], async (ctx, user, arg1) => {
    const auc = await Auction.findOne({ id: arg1 })

    if(!auc)
        return ctx.reply(user, `auction with ID \`${arg1}\` was not found`, 'red')

    const author = await fetchOnly(auc.author)
    const aucformat = await format_auc(ctx, auc, author)
    const card = ctx.cards[auc.card]

    return ctx.send(ctx.msg.channel.id, {
        title: `Auction [${auc.id}]`,
        image: { url: card.url },
        description: aucformat,
        color: colors['blue']
    }, user.discord_id)
}).access('dm')

cmd(['auc', 'info', 'all'], ['auction', 'info', 'all'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const now = new Date();
    const req = {finished: false}

    if(parsedargs.me === 1)
        req.author = user.discord_id

    let list = (await Auction.find(req).sort({ expires: 1 }))
        .filter(x => x.expires > now)

    if (parsedargs.me === 2)
        list = list.filter(x => x.author !== user.discord_id)

    if (parsedargs.diff)
        list = list.filter(x => parsedargs.diff == 1 ^ user.cards.some(y => y.id === x.card))

    if(parsedargs.bid === 1)
        list = list.filter(x => x.lastbidder && x.lastbidder === user.discord_id)
    else if(parsedargs.bid === 2)
        list = list.filter(x => !x.lastbidder || x.lastbidder != user.discord_id)

    if(!parsedargs.isEmpty())
        list = list.filter(x => cards.some(y => x.card === y.id))

    if(list.length === 0)
        return ctx.reply(user, `found 0 active auctions`, 'red')

    list = list.slice(0, 15)

    const pages = await Promise.all(list.map(async auc => {
        const author = await fetchOnly(auc.author).select('username')
        const aucformat = await format_auc(ctx, auc, author, false)

        return {
            id: auc.id,
            image: ctx.cards[auc.card].url,
            info: aucformat
        }
    }))

    return ctx.sendPgn(ctx, user, {
        pages,
        buttons: ['back', 'forward'],
        switchPage: (data) => {
            const page = data.pages[data.pagenum]
            data.embed.image.url = page.image
            data.embed.description = page.info
            data.embed.title = `Auction [${page.id}]`
        },
        embed: {
            title: 'Auction',
            image: { url: '' },
            description: 'loading',
            color: colors.blue
        }
    })
})).access('dm')

cmd(['auc', 'sell'], ['auction', 'sell'], withCards(async (ctx, user, cards, parsedargs) => {
    if (ctx.settings.aucLock)
        return ctx.reply(user, `selling on auction is currently disabled by the admins.\nFor more info you may inquire in the [Support Server](${ctx.invite}).`, 'red')
    const timelimit = asdate.subtract(new Date(), 1, 'hour')
    const curaucs = await Auction.find({finished: false, author: user.discord_id, time: {$gt: timelimit}})

    if(user.ban && user.ban.embargo)
        return ctx.reply(user, `you are not allowed to list cards at auction.
                                Your dealings were found to be in violation of our community rules.
                                You can inquire further on our [Bot Discord](${ctx.cafe})`, 'red')

    if(parsedargs.isEmpty())
        return ctx.reply(user, `please specify card`, 'red')

    if (user.dailystats.aucs >= 150)
        return ctx.reply(user, `you have reached the maximum amount of auctions you can create in one daily. Please wait until your next daily to create more!`, 'red')

    if (curaucs.length >= 30)
        return ctx.reply(user, `you have reached the maximum amount of auctions you can have listed at a time per hour. Please wait an hour before listing again!`, 'red')

    const card = bestMatch(cards)
    const ceval = await evalCard(ctx, card)
    let price = parsedargs.extra.filter(x => x.length < 7 && !isNaN(x) && Number(x) > 0).map(x => Number(x))[0] || Math.round(ceval)

    if(price <= 4)
        price *= ceval

    price = Math.round(price)
    //const fee = Math.round(auchouse.level > 1? price * .05 : price * .1)
    const fee = Math.round(price * .1)
    const min = Math.round(ceval * .5)
    const max = Math.round(ceval * 4)
    const timenum = -parsedargs.extra.filter(x => x[0] === '-').map(x => parseInt(x))[0]
    let time = 6

    if(timenum) {
        time = Math.min(Math.max(timenum, 1), 10);
    }

    const check = async () => {
        user = await fetchOnly(user.discord_id)
        const usercard = user.cards.find(x => x.id === card.id)

        if(!usercard)
            return ctx.reply(user, `impossible to proceed with confirmation: ${formatName(card)} not found in your list`, 'red')

        if(price < min)
            return ctx.reply(user, `you can't set price less than **${numFmt(min)}** ${ctx.symbols.tomato} for this card`, 'red')

        if(price > max)
            return ctx.reply(user, `you can't set price higher than **${numFmt(max)}** ${ctx.symbols.tomato} for this card`, 'red')

        if(user.exp < fee)
            return ctx.reply(user, `you have to have at least **${numFmt(fee)}** ${ctx.symbols.tomato} to auction for that price`, 'red')

        if(usercard.fav && usercard.amount === 1)
            return ctx.reply(user, `you are about to put up last copy of your favourite card for sale. 
                Please, use \`->fav remove ${card.name}\` to remove it from favourites first`, 'yellow')
    }

    const question = `Do you want to sell ${formatName(card)} on auction for ${numFmt(price)} ${ctx.symbols.tomato}? 
        ${timenum? `This auction will last **${time} hours**` : ''}
        ${card.amount > 1? '' : 'This is the only copy that you have'}
        ${(card.amount == 1 && card.rating)? 'You will lose your rating for this card' : ''}`

    ctx.sendCfm(ctx, user, {
        embed: { footer: { text: `This will cost ${numFmt(fee)} (10% fee)` } },
        force: ctx.globals.force,
        question,
        check,
        onConfirm: async () => { 
            var auc = await new_auc(ctx, user, card, price, fee, time)

            if(!auc) {
                return ctx.reply(user, `failed to create auction. Card might be missing or there was an internal server error.`, 'red')
            }

            ctx.mixpanel.track(
                "Auction Create", { 
                    distinct_id: user.discord_id,
                    auction_id: auc.id,
                    card_id: card.id,
                    card_name: card.name,
                    card_collection: card.col,
                    price,
            })

            ctx.reply(user, `you put ${formatName(card)} on auction for **${numFmt(price)}** ${ctx.symbols.tomato}
                Auction ID: \`${auc.id}\``)
            const wishes = await User.find({heroslots: "festivewish", wishlist: card.id})
            wishes.map(async (x) => {
                try {
                    await ctx.direct(x, `an auction for the card ${formatName(card)} on your wishlist has gone up on auction at \`${auc.id}\` for **${numFmt(price)}**${ctx.symbols.tomato}!`)
                } catch (e) {}
            })
        },
    })
}))

cmd(['auc', 'bid'], ['auction', 'bid'], 'bid', async (ctx, user, ...args) => {
    if(user.ban && user.ban.embargo)
        return ctx.reply(user, `you are not allowed to list cards at auction.
                                Your dealings were found to be in violation of our community rules.
                                You can inquire further on our [Bot Discord](${ctx.cafe})`, 'red')

    const now = new Date();
    const bid = parseInt(args.find(x => !isNaN(x)))
    const id = args.find(x => isNaN(x))

    if(!id)
        return ctx.reply(user, `please specify auction ID`, 'red')

    if(!bid)
        return ctx.reply(user, `please specify bid amount`, 'red')

    const auc = await Auction.findOne({id: id})


    if(!auc)
        return ctx.reply(user, `auction with ID \`${id}\` wasn't found`, 'red')

    const lastBidder = auc.lastbidder === user.discord_id

    if((!lastBidder && user.exp < bid) || (lastBidder && user.exp < bid - auc.highbid))
        return ctx.reply(user, `you don't have \`${numFmt(bid)}\` ${ctx.symbols.tomato} to bid`, 'red')

    if(auc.cancelled)
        return ctx.reply(user, `auction \`${auc.id}\` was cancelled and is now finished`, 'red')

    if(auc.expires < now || auc.finished)
        return ctx.reply(user, `auction \`${auc.id}\` already finished`, 'red')

    if(auc.author === user.discord_id)
        return ctx.reply(user, `you cannot bid on your own auction`, 'red')

    if(auc.price >= bid)
        return ctx.reply(user, `your bid should be higher than **${numFmt(auc.price)}** ${ctx.symbols.tomato}`, 'red')

    if(lastBidder){
        if (bid < auc.highbid)
            return ctx.reply(user, `you cannot lower how much you bid!`, 'red')
        await bid_auc(ctx, user, auc, bid, true)
    } else {
        await bid_auc(ctx, user, auc, bid)
    }

}).access('dm')

cmd(['auc', 'cancel'], ['auction', 'cancel'], async (ctx, user, arg1, arg2) => {
    let auc = await Auction.findOne({ id: arg1 })

    if(!auc)
        return ctx.reply(user, `auction with ID \`${arg1}\` was not found`, 'red')

    const card = ctx.cards[auc.card]

    const check = async () => {
        auc = await Auction.findOne({ id: arg1 })

        if(auc.author != user.discord_id)
            return ctx.reply(user, `you don't have rights to cancel this auction`, 'red')

        if(auc.lastbidder)
            return ctx.reply(user, `you cannot cancel this auction. A person has already bid on it`, 'red')

        if(auc.expires < asdate.add(new Date(), 1, 'hour'))
            return ctx.reply(user, `you cannot cancel auction that expires in less than one hour`, 'red')
    }

    const question = `Do you want to cancel auction \`${auc.id}\` for ${formatName(card)}?`
    ctx.sendCfm(ctx, user, {
        embed: { footer: { text: `You won't get a fee refund` } },
        force: ctx.globals.force,
        question,
        check,
        onConfirm: async () => {
            auc.expires = new Date(0)
            auc.cancelled = true
            await auc.save()

            return ctx.reply(user, `auction \`${auc.id}\` was marked for expiration. You will get your card back soon`)
        }
    })
}).access('dm')
