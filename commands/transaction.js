const {cmd, pcmd}           = require('../utils/cmd')
const {Transaction}         = require('../collections')
const paginator             = require('../utils/paginator')
const {
    equals, 
    formatName,
    withGlobalCards
}  = require('../modules/card')

const {
    confirm_trs,
    decline_trs,
    check_trs,
    paginate_trslist
} = require('../modules/transaction')

cmd(['trans', 'confirm'], 'confirm', 'cfm', (ctx, user, arg1) => {
    confirm_trs(ctx, user, arg1)
})

cmd(['trans', 'decline'], 'decline', 'dcl', (ctx, user, arg1) => {
    decline_trs(ctx, user, arg1)
})

cmd('trans', async (ctx, user) => {
    const list = await Transaction.find({ 
        $or: [{ to_id: user.discord_id }, { from_id: user.discord_id }] 
    }).sort({ time: -1 })

    if(list.length == 0)
        return ctx.reply(user, `you don't have any recent transactions`)

    return await paginator.addPagination(ctx, user, 
        `your transactions (${list.length} results)`, 
        paginate_trslist(ctx, user, list))
})

cmd(['trans', 'pending'], 'pending', async (ctx, user) => {
    const list = await Transaction.find({ 
        $or: [{ to_id: user.discord_id }, { from_id: user.discord_id }],
        status: 'pending'
    }).sort({ time: 1 })

    if(list.length == 0)
        return ctx.reply(user, `you don't have any pending transactions`)

    return await paginator.addPagination(ctx, user, 
        `your pending transactions (${list.length} results)`, 
        paginate_trslist(ctx, user, list))
})

cmd(['trans', 'gets'], 'gets', async (ctx, user) => {
    const list = await Transaction.find({ 
        to_id: user.discord_id
    }).sort({ time: -1 })

    if(list.length == 0)
        return ctx.reply(user, `you don't have any recent incoming transactions`)

    return await paginator.addPagination(ctx, user, 
        `your incoming (${list.length} results)`, 
        paginate_trslist(ctx, user, list))
})

cmd(['trans', 'sends'], 'sends', async (ctx, user) => {
    const list = await Transaction.find({ 
        from_id: user.discord_id
    }).sort({ time: -1 })

    if(list.length == 0)
        return ctx.reply(user, `you don't have any recent outgoing transactions`)

    return await paginator.addPagination(ctx, user, 
        `your outgoing (${list.length} results)`, 
        paginate_trslist(ctx, user, list))
})

cmd(['trans', 'info'], async (ctx, user, args1) => {
    const trs = await Transaction.findOne({ id: arg1 })

    if(!trs)
        return ctx.reply(user, `transaction with ID \`${args1}\` was not found`, 'red')


    //const format = `your transactions:\n${format_trs(ctx, user, list)}`
    //return ctx.reply(user, format)
})

pcmd(['admin', 'mod'], ['trans', 'find'], withGlobalCards(async (ctx, user, cards) => {
    const list = await Transaction.find({ 
        card: { $in: cards.map(c => c.id) }
    }).sort({ time: -1 }).limit(100)

    if(list.length == 0)
        return ctx.reply(user, `matched ${cards.length} cards and 0 transactions`)

    return await paginator.addPagination(ctx, user, 
        `matched ${cards.length} cards and ${list.length} transactions`, 
        paginate_trslist(ctx, user, list))
}))