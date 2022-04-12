const colors = require('../utils/colors')
const msToTime = require('pretty-ms')
const lockFile  = require('proper-lockfile')

const {
    User,
    Transaction,
    UserCard,
}   = require('../collections')

const {
    generateNextId,
    numFmt,
} = require('../utils/tools')

const {
    formatName,
} = require('./card')

const {
    addUserCards, 
    removeUserCards,
    fetchOnly,
} = require('./user')

const {
    completed,
} = require('./collection')

const {
    trans_fraud_check,
} = require('./audit')

const {
    getStats,
} = require("./userstats");

const new_trs = (ctx, user, cards, price, to_id) => new Promise(async (resolve, reject) => {

    lockFile.lock('trans', {retries: 5}).then( async (release) => {
        const target = await User.findOne({ discord_id: to_id })
        const last_trs = (await Transaction.find({status: {$ne: 'auction'}})
            .sort({ time: -1 }))[0]
        const transaction = new Transaction()
        transaction.id = getNewID(last_trs)
        transaction.from = user.username
        transaction.from_id = user.discord_id
        transaction.to = target? target.username : 'bot'
        transaction.to_id = to_id
        transaction.guild = ctx.interaction.channel.guild.name
        transaction.guild_id = ctx.interaction.channel.guild.id
        transaction.status = 'pending'
        transaction.time = new Date()
        transaction.cards = cards.map(x => x.id)
        transaction.price = price
        await transaction.save()
        await lockFile.unlock('trans')
        return resolve(transaction)
    }).catch(async (e) => {
        await lockFile.unlock('trans')
        return reject(e)
    })
})

const from_auc = async (auc, from, to) => {
    const transaction = new Transaction()
    transaction.id = auc.id
    transaction.from = from.username
    transaction.from_id = from.discord_id

    if(to) {
        transaction.to = to.username
        transaction.to_id = to.discord_id
    }
    
    transaction.status = 'auction'
    transaction.time = new Date()
    transaction.cards = [auc.card]
    transaction.price = auc.price
    transaction.guild_id = auc.guild

    return transaction.save()
}

const confirm_trs = async (ctx, user, trs_id, edit = true) => {
    if(typeof user === 'string')
        user = await fetchOnly(user)

    if(!user) return;

    const transaction = await Transaction.findOne({ id: trs_id, status: 'pending' })

    if(!transaction)
        return ctx.reply(user, `transaction with id \`${trs_id}\` was not found`, 'red', edit)

    const from_user = await fetchOnly(transaction.from_id)
    const to_user = await fetchOnly(transaction.to_id)
    const cards = await UserCard.find({ 
        userid: transaction.from_id,
        cardid: { $in: transaction.cards } 
    }).lean()
    let fromStats = await getStats(ctx, from_user, from_user.lastdaily)

    if(cards.length != transaction.cards.length){
        transaction.status = 'declined'
        await transaction.save()
        return ctx.reply(to_user || from_user, `this transaction is not valid anymore. Seller doesn't have some of the cards in this transaction.`, 'red', edit)
    }

    if(to_user) {
        if(user.discord_id != transaction.to_id)
            return ctx.reply(user, `you don't have rights to confirm this transaction`, 'red', edit)

        if(to_user.exp < transaction.price)
            return ctx.reply(to_user, `you need **${numFmt(Math.floor(transaction.price - to_user.exp))}** ${ctx.symbols.tomato} more to confirm this transaction`, 'red', edit)
        
        to_user.exp -= transaction.price

        let toStats = await getStats(ctx, to_user, to_user.lastdaily)
        toStats.userbuy += transaction.cards.length
        toStats.tomatoout += transaction.price
        await toStats.save()

        fromStats.usersell += transaction.cards.length
        await to_user.save()
        await addUserCards(ctx, to_user, transaction.cards)
        await completed(ctx, to_user, transaction.cards)

    } else if(user.discord_id != transaction.from_id) {
        return ctx.reply(user, `you don't have rights to confirm this transaction`, 'red', edit)
    } else {
        fromStats.botsell += transaction.cards.length
    }

    transaction.cards.map(async (x) => {
        await trans_fraud_check(ctx, from_user, transaction, x)
    })


    await from_user.save()
    await removeUserCards(ctx, from_user, transaction.cards)
    await completed(ctx, from_user, transaction.cards)

    from_user.exp += transaction.price
    fromStats.tomatoin += transaction.price
    transaction.status = 'confirmed'

    await from_user.save()
    await transaction.save()
    await fromStats.save()

    /*ctx.mixpanel.track(
        "Card Sell", { 
            distinct_id: user.discord_id,
            card_id: card.id,
            card_name: card.name,
            card_collection: card.col,
            price: transaction.price,
            to_user,
    })*/

    if(to_user) {
        if (transaction.cards.length === 1)
            return ctx.reply(from_user, `sold **${formatName(ctx.cards[transaction.cards[0]])}** to **${transaction.to}** for **${numFmt(transaction.price)}** ${ctx.symbols.tomato}`, 'green', edit)

        return ctx.reply(from_user, `sold **${transaction.cards.length} card(s)** to **${transaction.to}** for **${numFmt(transaction.price)}** ${ctx.symbols.tomato}`, 'green', edit)
    }

    if (transaction.cards.length === 1)
        return ctx.reply(user, `sold **${formatName(ctx.cards[transaction.cards[0]])}** to **${transaction.to}** for **${numFmt(transaction.price)}** ${ctx.symbols.tomato}`, 'green', edit)

    return ctx.reply(user, `sold **${transaction.cards.length} card(s)** to **${transaction.to}** for **${numFmt(transaction.price)}** ${ctx.symbols.tomato}`, 'green', edit)
}

const decline_trs = async (ctx, user, trs_id, edit = true) => {
    if(typeof user === 'string')
        user = await User.findOne({ discord_id: user })

    if(!user) return;

    const transaction = await Transaction.findOne({ id: trs_id, status: 'pending' })

    if(!transaction)
        return ctx.reply(user, `transaction with id **${trs_id}** was not found`, 'red', edit)

    if(!(user.discord_id === transaction.from_id || user.discord_id === transaction.to_id) && !user.isMod)
        return ctx.reply(user, `you don't have rights to decline this transaction`, 'red', edit)

    transaction.status = 'declined'
    await transaction.save()

    return ctx.reply(user, `transaction \`${trs_id}\` was declined`, 'green', edit)
}

const check_trs = async (ctx, user, target) => {
    return await Transaction.find({ from_id: user.discord_id, status: 'pending', to_id: target })
}

const validate_trs = async (ctx, user, cards, id, targetuser) => {
    if(user.ban && user.ban.embargo)
        return `you are not allowed to sell cards.
                Your dealings were found to be in violation of our community rules.
                You can inquire further on our [Bot Discord](${ctx.cafe})`

    if(targetuser && targetuser.ban && (targetuser.ban.embargo || targetuser.ban.full))
        return `the user you are attempting to sell to is embargoed.
                Cards cannot be sold to this user until they have had their embargo lifted.
                You can inquire further on our [Bot Discord](${ctx.cafe})`
    
    if(!ctx.interaction.channel.guild)
        return `transactions are possible only in guild channel`

    const pending = await getPendingFrom(ctx, user)
    const pendingto = pending.filter(x => x.to_id === id)
    cards.splice(100, cards.length)

    if(targetuser && targetuser.discord_id === user.discord_id) {
        return `you cannot sell cards to yourself.`
    }

    if(!targetuser && pendingto.length > 0)
        return `you already have pending transaction to **BOT**. 
            First resolve transaction \`${pending[0].id}\`
            Type \`/transaction info transaction_id:${pending[0].id}\` to see more information
            \`/transaction confirm transaction_id:${pending[0].id}\` to confirm
            \`/transaction decline transaction_id:${pending[0].id}\` to decline`

    else if(pendingto.length >= 5)
        return `you already have pending transactions to **${pendingto[0].to}**. 
            You can have up to **5** pending transactions to the same user.
            Type \`/transaction pending\` to see them
            \`/transaction decline transaction_id:id\` to decline`

    let lastFav = false
    let listedFavs = 0
    let lastMsg = 'you are about to put up the last copy of your favorite card(s) for sale.\n'
    cards.map((x, i) => {
        if (x.amount === 1 && x.fav && listedFavs < 10) {
            lastMsg += `Use \`${ctx.prefix}fav remove one card_query:${x.name}\` to remove it from favorites first.\n`
            lastFav = true
            listedFavs++
        }
    })
    if (lastFav)
        return lastMsg

    if(pending.length > 0) {
        const pendingCards = pending.reduce((acc, cur) => acc.concat(cur.cards), [])
        cards = cards.filter(x => {
            const pendingCount = pendingCards.filter(z => z == x.id).length
            const remaining = x.amount - pendingCount
            return !(remaining < 1 || remaining < 2 && x.fav);
        })

        if(cards.length == 0) {
            return `all cards from this query are already put up on sale or you are attempting to sell the last of a favorite already in a transaction.
                Check your \`${ctx.prefix}transaction pending\` transactions and use \`/transaction decline transaction_id:id\` to decline them.`
        }
    }
}

const paginate_trslist = (ctx, user, list) => {
    const pages = []
    list.map((t, i) => {
        if (i % 10 == 0) pages.push("")
        pages[Math.floor(i/10)] += `${format_listtrs(ctx, user, t)}\n`
    })

    return pages;
}

const format_listtrs = (ctx, user, trans) => {
    let resp = ""
    const timediff = msToTime(new Date() - trans.time, {compact: true})
    const isget = trans.from_id != user.discord_id

    if (trans.cards.length === 1)
        resp += `[${timediff}] ${ch_map[trans.status]} \`${trans.id}\` ${formatName(ctx.cards[trans.cards[0]])}`
    else
        resp += `[${timediff}] ${ch_map[trans.status]} \`${trans.id}\` ${trans.cards.length} card(s)`
    resp += isget ? ` \`<-\` **${trans.from}**` : ` \`->\` **${trans.to}**`;
    return resp;
}

const getPending = (ctx, user, req) => Transaction.find({ 
        $or: [{ to_id: user.discord_id }, { from_id: user.discord_id }],
        status: 'pending'
    }).sort({ time: 1 })

const getPendingFrom = (ctx, user) => Transaction.find({ 
        from_id: user.discord_id,
        status: 'pending'
    }).sort({ time: 1 })

const getNewID = (last_trs) => {
    if(!last_trs)
        return generateNextId('aaaaaa', 6)
    return generateNextId(last_trs.id, 6)
}

const ch_map = {
    confirmed: "\`✅\`",
    declined: "\`❌\`",
    pending: "\`❗\`",
    auction: "\`🔨\`"
}

module.exports = {
    new_trs,
    confirm_trs,
    decline_trs,
    check_trs,
    validate_trs,
    format_listtrs,
    paginate_trslist,
    ch_map,
    from_auc,
    getPending,
    getPendingFrom
}
