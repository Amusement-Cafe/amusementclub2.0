const {cmd, pcmd}           = require('../utils/cmd')
const {numFmt}              = require('../utils/tools')
const {Transaction}         = require('../collections')
const msToTime              = require('pretty-ms')
const colors                = require('../utils/colors')
const dateFormat            = require(`dateformat`)

const {
    formatName,
    withGlobalCards,
}  = require('../modules/card')

const {
    confirm_trs,
    decline_trs,
    paginate_trslist,
    ch_map,
    getPending,
} = require('../modules/transaction')

cmd(['trans', 'confirm'], 'confirm', 'cfm', 'accept', (ctx, user, arg1) => {
    confirm_trs(ctx, user, arg1)
})

cmd(['trans', 'decline'], 'decline', 'dcl', 'reject', (ctx, user, arg1) => {
    decline_trs(ctx, user, arg1)
})

cmd('trans', withGlobalCards(async (ctx, user, cards, parsedargs) => {
    let list = await Transaction.find({ 
        $or: [{ to_id: user.discord_id }, { from_id: user.discord_id }] 
    }).sort({ time: -1 })

    if(!parsedargs.isEmpty())
        list = list.filter(x => cards.some(y => x.cards.includes(y.id)))

    if(list.length == 0)
        return ctx.reply(user, `you don't have recent transactions`)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: paginate_trslist(ctx, user, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, your transactions (${list.length} results)` },
            color: colors.blue,
        }
    })
}))

cmd(['trans', 'pending'], 'pending', withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const list = await getPending(ctx, user)

    if(!parsedargs.isEmpty())
        list = list.filter(x => cards.some(y => x.cards.includes(y.id)))

    if(list.length == 0)
        return ctx.reply(user, `you don't have any pending transactions`)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: paginate_trslist(ctx, user, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, your pending transactions (${list.length} results)` },
            color: colors.yellow,
        }
    })
}))

cmd(['trans', 'gets'], 'gets', withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const list = await Transaction.find({ 
        to_id: user.discord_id
    }).sort({ time: -1 })

    if(!parsedargs.isEmpty())
        list = list.filter(x => cards.some(y => x.cards.includes(y.id)))

    if(list.length == 0)
        return ctx.reply(user, `you don't have any recent incoming transactions`)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: paginate_trslist(ctx, user, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, your incoming transactions (${list.length} results)` },
            color: colors.green,
        }
    })
}))

cmd(['trans', 'sends'], 'sends', withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const list = await Transaction.find({ 
        from_id: user.discord_id
    }).sort({ time: -1 })

    if(!parsedargs.isEmpty())
        list = list.filter(x => cards.some(y => x.cards.includes(y.id)))

    if(list.length == 0)
        return ctx.reply(user, `you don't have any recent outgoing transactions`)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: paginate_trslist(ctx, user, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, your outgoing transactions (${list.length} results)` },
            color: colors.green,
        }
    })
}))

cmd(['trans', 'auction'], ['trans', 'auc'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    let authorText, list
    switch (arg1) {
        case 'gets' :
            list = await Transaction.find({
                to_id: user.discord_id ,
                status: 'auction'
            }).sort({ time: -1 })
            authorText = `${user.username}, your incoming auction transactions (${list.length} results)`
            break
        case 'sends' :
            list = await Transaction.find({
                from_id: user.discord_id,
                status: 'auction'
            }).sort({ time: -1 })
            authorText = `${user.username}, your outgoing auction transactions (${list.length} results)`
            break
        default:
            list = await Transaction.find({
                $or: [{ to_id: user.discord_id }, { from_id: user.discord_id }],
                status: 'auction'
            }).sort({ time: -1 })
            authorText = `${user.username}, your auction transactions (${list.length} results)`
    }

    if(!parsedargs.isEmpty())
        list = list.filter(x => cards.some(y => x.cards.includes(y.id)))

    if(list.length == 0)
        return ctx.reply(user, `you don't have any recent auction transactions`)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: paginate_trslist(ctx, user, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: authorText },
            color: colors.green,
        }
    })
}))

cmd(['trans', 'info'], async (ctx, user, arg1) => {
    const trs = await Transaction.findOne({ id: arg1 })

    if(!trs)
        return ctx.reply(user, `transaction with ID \`${arg1}\` was not found`, 'red')

    if(user.discord_id != trs.to_id && user.discord_id != trs.from_id)
        return ctx.reply(user, `you do not have permission to view \`${arg1}\``, 'red')

    const card = ctx.cards[trs.card]
    const timediff = msToTime(new Date() - trs.time, {compact: true})

    const resp = []
    resp.push(`Cards: **${trs.cards.length}**`)
    resp.push(`Price: **${numFmt(trs.price)}** ${ctx.symbols.tomato}`)
    resp.push(`From: **${trs.from}**`)
    resp.push(`To: **${trs.to}**`)

    if(trs.guild) {
        resp.push(`On server: **${trs.guild}**`)
        resp.push(`Status: **\`${ch_map[trs.status]}\` ${trs.status}**`)
    } else {
        resp.push(`${ch_map[trs.status]} This is an **auction** transaction`)
    }
    
    resp.push(`Date: **${dateFormat(trs.time, "yyyy-mm-dd HH:MM:ss")}**`)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(trs.cards.map(c => formatName(ctx.cards[c])), 10),
        switchPage: (data) => data.embed.fields[0].value = data.pages[data.pagenum],
        embed: {
            author: { name: `Transaction [${trs.id}] (${timediff})` },
            description: resp.join('\n'),
            color: colors.blue,
            fields: [{
                name: "Cards",
                value: ""
            }]
        }
    })
})

pcmd(['admin', 'mod'], ['trans', 'find'], withGlobalCards(async (ctx, user, cards) => {
    const list = await Transaction.find({ 
        card: { $in: cards.map(c => c.id) }
    }).sort({ time: -1 }).limit(100)

    if(list.length == 0)
        return ctx.reply(user, `matched ${cards.length} cards and 0 transactions`)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: paginate_trslist(ctx, user, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, matched ${cards.length} cards and ${list.length} transactions` },
            color: colors.blue,
        }
    })
}))
