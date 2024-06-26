const {cmd}             = require('../utils/cmd')
const {numFmt}          = require('../utils/tools')
const {evalCard}        = require('../modules/eval')
const msToTime          = require('pretty-ms')
const colors            = require('../utils/colors')
const asdate            = require('add-subtract-date')

const {
    Auction,
    User,
    UserSlot,
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

const {
    getStats,
    saveAndCheck,
} = require("../modules/userstats");

const {
    fetchOnly, 
    findUserCards,
} = require('../modules/user')

const {
    withInteraction,
} = require("../modules/interactions")

const {
    getBuilding,
} = require("../modules/guild")

cmd(['auction', 'list'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const now = new Date()
    const req = {finished: false}

    if(parsedargs.me)
        req.author = user.discord_id

    let list = (await Auction.find(req).sort({ expires: 1 }).lean())
        .filter(x => x.expires > now)

    if (!parsedargs.me && parsedargs.me !== undefined)
        list = list.filter(x => x.author !== user.discord_id)

    if (parsedargs.diff) {
        const userCards = await findUserCards(ctx, user, list.map(x => x.card))
        list = list.filter(x => parsedargs.diff == 1 ^ userCards.some(y => y.cardid === x.card))
    }

    if(parsedargs.bid)
        list = list.filter(x => x.lastbidder && x.lastbidder === user.discord_id)
    else if(!parsedargs.bid && parsedargs.bid !== undefined)
        list = list.filter(x => !x.lastbidder || x.lastbidder != user.discord_id)

    if(!parsedargs.isEmpty())
        list = list.filter(x => cards.some(y => x.card === y.id))

    if(list.length === 0)
        return ctx.reply(user, `found 0 active auctions`, 'red')

    list = list.slice(0, 200)

    return ctx.sendPgn(ctx, user, {
        pages: paginate_auclist(ctx, user, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, found auctions (${list.length} results)` },
            color: colors.blue,
        }
    })
}))).access('dm')

cmd(['auction', 'info'], withInteraction(async (ctx, user, args) => {
    const auc = await Auction.findOne({ id: args.aucID })

    if(!auc)
        return ctx.reply(user, `auction with ID \`${args.aucID}\` was not found`, 'red')

    const author = await fetchOnly(auc.author)
    const aucformat = await format_auc(ctx, auc, author)
    const card = ctx.cards[auc.card]

    return ctx.send(ctx.interaction, {
        title: `Auction [${auc.id}]`,
        image: { url: card.url },
        description: aucformat,
        color: colors['blue']
    }, user.discord_id)
})).access('dm')

cmd(['auction', 'preview'], withInteraction(withGlobalCards(async (ctx, user, cards, args) => {
    const now = new Date();
    const req = {finished: false}

    if(args.me)
        req.author = user.discord_id

    let list = (await Auction.find(req).sort({ expires: 1 }))
        .filter(x => x.expires > now)

    if (!args.me && args.me !== undefined)
        list = list.filter(x => x.author !== user.discord_id)

    if (args.diff) {
        const userCards = await findUserCards(ctx, user, list.map(x => x.card))
        list = list.filter(x => args.diff == 1 ^ userCards.some(y => y.cardid === x.card))
    }

    if(args.bid)
        list = list.filter(x => x.lastbidder && x.lastbidder === user.discord_id)
    else if(args.bid !== undefined)
        list = list.filter(x => !x.lastbidder || x.lastbidder != user.discord_id)

    if(!args.isEmpty())
        list = list.filter(x => cards.some(y => x.card === y.id))

    if(list.length === 0)
        return ctx.reply(user, `found 0 active auctions`, 'red')

    list = list.slice(0, 25)

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
}))).access('dm')

cmd(['auction', 'sell'], withInteraction(withCards(async (ctx, user, cards, parsedargs) => {
    if (ctx.settings.aucLock)
        return ctx.reply(user, `selling on auction is currently disabled by the admins.\nFor more info you may inquire in the [Support Server](${ctx.invite}).`, 'red')

    if(user.ban && user.ban.embargo)
        return ctx.reply(user, `you are not allowed to list cards at auction.
                                Your dealings were found to be in violation of our community rules.
                                You can inquire further on our [Bot Discord](${ctx.cafe})`, 'red')

    if(parsedargs.isEmpty())
        return ctx.reply(user, `please specify card`, 'red')

    cards = cards.filter(x => !x.locked)

    if (cards.length === 0)
        return ctx.reply(user, `you are attempting to sell a locked card, or no longer own the card you are attempting to put on auction!`, 'red')

    const card = bestMatch(cards)
    const ceval = await evalCard(ctx, card)
    let price = parsedargs.price || Math.round(ceval)

    if(price <= 4)
        price *= ceval

    const hasBuilding = await getBuilding(ctx, ctx.guild.id, 'discountcenter')
    const multiplier = hasBuilding? 1 - (hasBuilding.level * 0.05): 1
    price = Math.round(price)
    const fee = Math.round((price * (ctx.auctionFeePercent / 100)) * multiplier)
    const min = Math.round(ceval * .5)
    const max = Math.round(ceval * 4)
    const timenum = parsedargs.timeLength
    let time = 6

    if(timenum) {
        time = Math.min(Math.max(timenum, 1), 10);
    }

    const check = async () => {
        const usercard = (await findUserCards(ctx, user, [card.id]))[0]

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
                Please, use \`/fav remove one\` to remove it from favourites first`, 'yellow')
    }

    const question = `Do you want to sell ${formatName(card)} on auction for ${numFmt(price)} ${ctx.symbols.tomato}? 
        ${timenum? `This auction will last **${time} hours**` : ''}
        ${card.amount > 1? '' : 'This is the only copy that you have'}
        ${(card.amount == 1 && card.rating)? 'You will lose your rating for this card' : ''}`

    ctx.sendCfm(ctx, user, {
        embed: { footer: { text: `This will cost ${numFmt(fee)} (${ctx.auctionFeePercent}% fee${hasBuilding? `, the cost was reduced by ${Math.floor((hasBuilding.level * 0.05) * 100)}% due to a Discount Center`: ''})` } },
        force: ctx.globals.force,
        question,
        check,
        onConfirm: async () => { 
            const auc = await new_auc(ctx, user, card, price, fee, time)

            if(!auc) {
                return ctx.reply(user, `failed to create auction. Card might be missing or there was an internal server error.`, 'red', true)
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
                Auction ID: \`${auc.id}\``, 'green', true)
            const festive = (await UserSlot.find({effect_name: 'festivewish'}).lean()).map(x => x.discord_id)
            const wishes = await User.find({discord_id: {$in: festive}, wishlist: card.id})
            wishes.map(async (x) => {
                try {
                    await ctx.direct(x, `an auction for the card ${formatName(card)} on your wishlist has gone up on auction at \`${auc.id}\` for **${numFmt(price)}**${ctx.symbols.tomato}!`)
                } catch (e) {}
            })
            let stats = await getStats(ctx, user, user.lastdaily)
            stats.aucsell += 1
            await saveAndCheck(ctx, user, stats)
        },
    })
})))

cmd(['auction', 'bid'], withInteraction(async (ctx, user, args) => {
    if(user.ban && user.ban.embargo)
        return ctx.reply(user, `you are not allowed to list cards at auction.
                                Your dealings were found to be in violation of our community rules.
                                You can inquire further on our [Bot Discord](${ctx.cafe})`, 'red')

    const now = new Date();
    const bid = args.price
    const id = args.aucID

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
        if (bid <= auc.highbid)
            return ctx.reply(user, `you cannot re-bid at the same price or lower!`, 'red')
        await bid_auc(ctx, user, auc, bid, true)
    } else {
        await bid_auc(ctx, user, auc, bid)
    }

}, {ephemeral: true})).access('dm')

cmd(['auction', 'cancel'], withInteraction(async (ctx, user, args) => {
    let auc = await Auction.findOne({ id: args.aucID })

    if(!auc)
        return ctx.reply(user, `auction with ID \`${args.aucID}\` was not found`, 'red')

    const card = ctx.cards[auc.card]

    const check = async () => {
        auc = await Auction.findOne({ id: args.aucID })

        if(auc.author != user.discord_id)
            return ctx.reply(user, `you don't have rights to cancel this auction`, 'red', true)

        if(auc.lastbidder)
            return ctx.reply(user, `you cannot cancel this auction. A person has already bid on it`, 'red', true)

        if(auc.expires < asdate.add(new Date(), 1, 'hour'))
            return ctx.reply(user, `you cannot cancel auction that expires in less than one hour`, 'red', true)
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
            let stats = await getStats(ctx, user, user.lastdaily)
            stats.aucsell -= 1
            await saveAndCheck(ctx, user, stats)

            return ctx.reply(user, `auction \`${auc.id}\` was marked for expiration. You will get your card back soon`, 'green', true)
        }
    })
})).access('dm')
