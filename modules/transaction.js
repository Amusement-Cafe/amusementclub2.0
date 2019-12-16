const {User, Transaction}   = require('../collections')
const {addUserCard}         = require('./card')
const {
    formatName
} = require('../modules/card')

const new_trs = async (ctx, user, card, to_id) => {
    const target = await User.findOne({ discord_id: to_id })
    const transaction = new Transaction()
    transaction.id = getNewID()
    transaction.from = user.username
    transaction.from_id = user.discord_id
    transaction.to = target? target.username : 'bot'
    transaction.to_id = to_id
    transaction.guild = ctx.msg.channel.guild.name
    transaction.guild_id = ctx.msg.channel.guild.id
    transaction.status = 'pending'
    transaction.time = new Date()
    transaction.card = card.id
    transaction.price = target? 300 : 100

    await transaction.save()
    return transaction
}

const confirm_trs = async (ctx, user, trs_id) => {
    const transaction = await Transaction.findOne({ id: trs_id })

    console.log(transaction)

    if(!transaction)
        return ctx.reply(user, `transaction with id \`${trs_id}\` was not found`, 'red')

    if(transaction.status != 'pending')
        return ctx.reply(user, `this transaction was already **${transaction.status}**`, 'red')

    const from_user = await User.findOne({ discord_id: transaction.from_id })
    const to_user = await User.findOne({ discord_id: transaction.to_id })
    const card = from_user.cards.filter(x => x.id == transaction.card)[0]

    if(!card){
        transaction.status = 'declined'
        await transaction.save()
        return ctx.reply(to_user, `seller doesn't have this card anymore. Transaction was declined`, 'red')
    }

    if(to_user) {
        if(user.discord_id != transaction.to_id)
            return ctx.reply(user, `you don't have rights to confirm this transaction`, 'red')

        if(to_user.exp < transaction.price)
            return ctx.reply(to_user, `you need **${Math.floor(transaction.price - to_user.exp)}** {currency} to confirm this transaction`, 'red')

        addUserCard(to_user, card)
        to_user.exp -= transaction.price

        await to_user.save()

    } else if(user.discord_id != transaction.from_id)
        return ctx.reply(user, `you don't have rights to confirm this transaction`, 'red')

    if(card.amount > 1)
        card.amount--
    else
        from_user.cards = from_user.cards.filter(x => x.id != card.id)

    from_user.exp += transaction.price
    transaction.status = 'confirmed'

    await from_user.save()
    await transaction.save()

    return ctx.reply(user, `sold **${formatName(ctx.cards[card.id])}** to **${transaction.to}** for **${transaction.price}** {currency}`)
}

const decline_trs = async (ctx, user, trs_id) => {
    const transaction = await Transaction.findOne({ id: trs_id })

    if(!transaction)
        return ctx.reply(user, `transaction with id **${trs_id}** was not found`, 'red')

    console.log(user.discord_id)
    console.log(transaction)

    if(!(user.discord_id === transaction.from_id || user.discord_id === transaction.to_id) && !user.isMod)
        return ctx.reply(user, `you don't have rights to decline this transaction`, 'red')

    transaction.status = 'declined'
    await transaction.save()

    return ctx.reply(user, `transaction \`${trs_id}\` was declined`)
}

const check_trs = async (ctx, user, target) => {
    return await Transaction.findOne({ from_id: user.discord_id, status: 'pending', to_id: target })
}

const getNewID = () => {
    return Math.random() * 100
}

module.exports = {
    new_trs,
    confirm_trs,
    decline_trs,
    check_trs
}