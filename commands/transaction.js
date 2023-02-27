const {cmd, pcmd}           = require('../utils/cmd')
const {Transaction}         = require('../collections')
const msToTime              = require('pretty-ms')
const colors                = require('../utils/colors')
const dateFormat            = require(`dateformat`)

const {
    numFmt,
    formatDateTimeLong,
} = require('../utils/tools')

const {
    formatName,
    withGlobalCards,
} = require('../modules/card')

const {
    confirm_trs,
    decline_trs,
    paginate_trslist,
    ch_map,
    getPending,
} = require('../modules/transaction')

const {
    withInteraction,
} = require("../modules/interactions")

cmd(['transaction', 'confirm'], withInteraction((ctx, user, args) => {
    confirm_trs(ctx, user, args.transID, false)
}))

cmd(['transaction', 'decline'], withInteraction((ctx, user, args) => {
    decline_trs(ctx, user, args.transID, false)
}))

cmd(['transaction', 'list'], withInteraction(withGlobalCards(async (ctx, user, cards, parsedargs) => {
    let query = {}

    if (parsedargs.auctions)
        query.status = 'auction'
    else if (!parsedargs.auctions && parsedargs.auctions !== undefined)
        query.status = {$ne: 'auction'}

    if (parsedargs.pending)
        query.status = 'pending'
    else if (!parsedargs.pending && parsedargs.pending !== undefined && !parsedargs.auctions && parsedargs.auctions !== undefined)
        query = {$nor: [{status: 'pending'}, {status: 'auction'}]}
    else if (!parsedargs.pending && parsedargs.pending !== undefined)
        query.status = {$ne: 'pending'}

    if (parsedargs.received)
        query.to_id = user.discord_id
    else if (!parsedargs.received && parsedargs.received !== undefined)
        query.from_id = user.discord_id
    else
        query = Object.assign({}, query, {$or: [{ to_id: user.discord_id }, { from_id: user.discord_id }]})

    let list = await Transaction.find(query).sort({ time: -1 })

    if(parsedargs.cardQuery)
        list = list.filter(x => cards.some(y => x.cards.includes(y.id)))

    if(list.length == 0)
        return ctx.reply(user, `you don't have recent transactions`)

    return ctx.sendPgn(ctx, user, {
        pages: paginate_trslist(ctx, user, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, your transactions (${list.length} results)` },
            color: colors.blue,
        }
    })
})))

cmd(['transaction', 'info'], withInteraction(async (ctx, user, args) => {
    const trs = await Transaction.findOne({ id: args.transID })

    if(!trs)
        return ctx.reply(user, `transaction with ID \`${args.transID}\` was not found`, 'red')

    if(user.discord_id != trs.to_id && user.discord_id != trs.from_id)
        return ctx.reply(user, `you do not have permission to view \`${args.transID}\``, 'red')

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
    
    resp.push(`Date: **${formatDateTimeLong(trs.time)}**`)

    return ctx.sendPgn(ctx, user, {
        pages: ctx.pgn.getPages(trs.cards.map(c => formatName(ctx.cards[c])), 15, 1024),
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
}))

pcmd(['admin', 'mod'], ['trans', 'find'], withInteraction(withGlobalCards(async (ctx, user, cards) => {
    const list = await Transaction.find({ 
        card: { $in: cards.map(c => c.id) }
    }).sort({ time: -1 }).limit(100)

    if(list.length == 0)
        return ctx.reply(user, `matched ${cards.length} cards and 0 transactions`)

    return ctx.sendPgn(ctx, user, {
        pages: paginate_trslist(ctx, user, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, matched ${cards.length} cards and ${list.length} transactions` },
            color: colors.blue,
        }
    })
})))
