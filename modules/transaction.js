const {Auction, Audit, User, Transaction}   = require('../collections')
const {generateNextId} = require('../utils/tools')
const colors = require('../utils/colors')
const msToTime = require('pretty-ms')

const {
    addUserCard, 
    removeUserCard,
    formatName
} = require('./card')

const {
    completed
} = require('./collection')

const {
    bulkIncrementUserCount
} = require('./eval')

const new_trs = async (ctx, user, cards, price, to_id) => {
    const target = await User.findOne({ discord_id: to_id })
    const last_trs = (await Transaction.find({status: {$ne: 'auction'}})
        .sort({ time: -1 }))[0]
    const transaction = new Transaction()
    transaction.id = getNewID(last_trs)
    transaction.from = user.username
    transaction.from_id = user.discord_id
    transaction.to = target? target.username : 'bot'
    transaction.to_id = to_id
    transaction.guild = ctx.msg.channel.guild.name
    transaction.guild_id = ctx.msg.channel.guild.id
    transaction.status = 'pending'
    transaction.time = new Date()
    transaction.cards = cards.map(x => x.id)
    transaction.price = price

    await transaction.save()
    return transaction
}

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
    transaction.card = auc.card
    transaction.price = auc.price
    transaction.guild_id = auc.guild

    return transaction.save()
}

const confirm_trs = async (ctx, user, trs_id) => {
    if(typeof user === 'string')
        user = await User.findOne({ discord_id: user })

    if(!user) return;

    const transaction = await Transaction.findOne({ id: trs_id, status: 'pending' })

    if(!transaction)
        return ctx.reply(user, `transaction with id \`${trs_id}\` was not found`, 'red')

    const from_user = await User.findOne({ discord_id: transaction.from_id })
    const to_user = await User.findOne({ discord_id: transaction.to_id })
    const cards = from_user.cards.filter(x => transaction.cards.some(y => y == x.id))

    if(cards.length != transaction.cards.length){
        transaction.status = 'declined'
        await transaction.save()
        return ctx.reply(to_user, `this transaction is not valid anymore. Seller doesn't have some of the cards in this transaction.`, 'red')
    }

    if(to_user) {
        if(user.discord_id != transaction.to_id)
            return ctx.reply(user, `you don't have rights to confirm this transaction`, 'red')

        if(to_user.exp < transaction.price)
            return ctx.reply(to_user, `you need **${Math.floor(transaction.price - to_user.exp)}** ${ctx.symbols.tomato} more to confirm this transaction`, 'red')
        
        to_user.exp -= transaction.price

        transaction.cards.map(x => addUserCard(to_user, x))
        await to_user.save()
        to_user.markModified('cards')
        await to_user.save()

        //await completed(ctx, to_user, fullCard)

        /*const auditCheck = await Auction.findOne({ author: transaction.to_id, card: card.id, bids: {$gte: 0}})
        if (auditCheck) {
            const auditDB = await new Audit()
            const last_audit = (await Audit.find().sort({ _id: -1 }))[0]
            auditDB.audit_id = last_audit? generateNextId(last_audit.audit_id, 7) : generateNextId('aaaaaaa', 7)
            auditDB.report_type = 3
            auditDB.transid = transaction.id
            auditDB.id = auditCheck.id
            auditDB.price = auditCheck.price
            auditDB.transprice =  transaction.price
            auditDB.audited = false
            auditDB.user = transaction.to
            auditDB.card = fullCard.name
            await auditDB.save()
        }*/

    } else if(user.discord_id != transaction.from_id) {
        return ctx.reply(user, `you don't have rights to confirm this transaction`, 'red')
    }

    transaction.cards.map(x => removeUserCard(from_user, x))
    await from_user.save()
    from_user.markModified('cards')
    await from_user.save()

    from_user.exp += transaction.price
    transaction.status = 'confirmed'

    await from_user.save()
    await transaction.save()

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
        return ctx.reply(from_user, `sold **${transaction.cards.length} cards** to **${transaction.to}** for **${transaction.price}** ${ctx.symbols.tomato}`)
    }

    return ctx.reply(user, `sold **${transaction.cards.length} cards** to **${transaction.to}** for **${transaction.price}** ${ctx.symbols.tomato}`)
}

const decline_trs = async (ctx, user, trs_id) => {
    if(typeof user === 'string')
        user = await User.findOne({ discord_id: user })

    if(!user) return;

    const transaction = await Transaction.findOne({ id: trs_id, status: 'pending' })

    if(!transaction)
        return ctx.reply(user, `transaction with id **${trs_id}** was not found`, 'red')

    if(!(user.discord_id === transaction.from_id || user.discord_id === transaction.to_id) && !user.isMod)
        return ctx.reply(user, `you don't have rights to decline this transaction`, 'red')

    transaction.status = 'declined'
    await transaction.save()

    return ctx.reply(user, `transaction \`${trs_id}\` was declined`)
}

const check_trs = async (ctx, user, target) => {
    return await Transaction.find({ from_id: user.discord_id, status: 'pending', to_id: target })
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

    resp += `[${timediff}] ${ch_map[trans.status]} \`${trans.id}\` ${trans.cards.length} cards`
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
    format_listtrs,
    paginate_trslist,
    ch_map,
    from_auc,
    getPending,
    getPendingFrom
}
