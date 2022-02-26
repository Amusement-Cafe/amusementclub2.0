const {parseArgs} = require("./card");
const {bestColMatchMulti} = require("./collection");

const withInteraction = (callback, ephemeral = false) => async (ctx, user, args) => {
    if (ephemeral)
        await ctx.interaction.acknowledge(64)
    else
        await ctx.interaction.acknowledge()

    args = await parseInteractionOptions(ctx, user)
    return callback(ctx, user, args)
}

const parseInteractionOptions = async (ctx, user) => {
    const interactionArgs = {
        global: false,
        cols: []
    }

    const cardArgs = parseArgs(ctx, user)
    let cardArgs1, cardArgs2
    ctx.options.map(x => {
        switch (x.name) {
            case 'amount': interactionArgs.amount = x.value; break;
            case 'anilist_link': interactionArgs.anilistLink = x.value; break;
            case 'auction_id': interactionArgs.aucID = x.value; break;
            case 'bid': interactionArgs.bid = x.value; break;
            case 'boost_id': interactionArgs.boostID = x.value; break;
            case 'card_query': interactionArgs.cardQuery = x.value; break;
            case 'card_query_1': cardArgs1 = parseArgs(ctx, user, x); interactionArgs.cardQuery1 = x.value; break;
            case 'card_query_2': cardArgs2 = parseArgs(ctx, user, x); interactionArgs.cardQuery2 = x.value; break;
            case 'claim_id': interactionArgs.claimID = x.value; break;
            case 'clouted': interactionArgs.clouted = x.value; break;
            case 'collection': interactionArgs.cols.push(x.value.split(' ').map(y => bestColMatchMulti(ctx, y.replace('-', '')))); interactionArgs.colQuery = x.value; break;
            case 'completed': interactionArgs.completed = x.value; break;
            case 'count': interactionArgs.count = x.value; break;
            case 'missing': interactionArgs.missing = x.value; break;
            case 'effect_name': interactionArgs.effect = x.value; break;
            case 'extra_arguments': interactionArgs.extraArgs = x.value; break;
            case 'hero': interactionArgs.hero = x.value; break;
            case 'inventory_item': interactionArgs.invItem = x.value; break;
            case 'item_id': interactionArgs.itemID = x.value; break;
            case 'me': interactionArgs.me = x.value; break;
            case 'notification_option': interactionArgs.option = x.value; break;
            case 'plot_number': interactionArgs.plot = x.value; break;
            case 'price': interactionArgs.price = x.value; break;
            case 'promo': interactionArgs.promo = x.value; break;
            case 'quest_number': interactionArgs.questNum = x.value; break;
            case 'rating': interactionArgs.rating = x.value; break;
            case 'slot_number': interactionArgs.slot = x.value; break;
            case 'store_number': interactionArgs.store = x.value; break;
            case 'tax_percentage': interactionArgs.tax = x.value; break;
            case 'time_length': interactionArgs.timeLength = x.value; break;
            case 'transaction_id': interactionArgs.transID = x.value; break;
            case 'unlocked': interactionArgs.any = x.value; break;
        }
    })
    return Object.assign({}, interactionArgs, cardArgs, {cardArgs1: cardArgs1, cardArgs2: cardArgs2})
}
module.exports = {
    withInteraction
}
