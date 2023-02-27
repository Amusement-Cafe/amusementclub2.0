const {pcmd}                    = require('../utils/cmd')
const {evalCard}                = require('../modules/eval')
const {getHelpEmbed}            = require('../commands/misc')
const {numFmt}                  = require('../utils/tools')
const colors                    = require('../utils/colors')
const msToTime                  = require('pretty-ms')
const dateFormat                = require(`dateformat`)

const {
    paginate_trslist,
    ch_map,
} = require('../modules/transaction')

const {
    fetchOnly,
    getUserCards,
} = require('../modules/user')

const {
    filter,
    formatName,
    mapUserCards,
    withGlobalCards,
}   = require('../modules/card')

const {
    createFindUserEmbed,
    formatAucBidList,
    paginateBotSells,
    paginateCompletedAuditList,
    paginateGuildTrsList,
    paginateOversells,
    paginateOverPrice,
    paginateRebuys,
}   = require("../modules/audit");

const {
    Audit,
    AuditAucSell,
    Auction,
    Transaction,
    User
}     = require('../collections')

const {
    withInteraction
} = require("../modules/interactions")

pcmd(['admin', 'auditor'], ['audit', 'report', 'one'], withInteraction( async (ctx, user) => {
    let overSell = await AuditAucSell.find({sold: {$gt:5}}).sort({sold: -1, unsold: 1})

    if (overSell.length === 0)
        return ctx.reply(user, 'nothing found for fraud report 1!')

    return ctx.sendPgn(ctx, user, {
        pages: await paginateOversells(ctx, user, overSell),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, open report 1 audits: (${numFmt(overSell.length)} results)` },
            color: colors.blue,
        }
    })
}))

pcmd(['admin', 'auditor'], ['audit', 'report', 'two'], withInteraction( async (ctx, user) => {
    let overPrice = (await Audit.find({ audited: false, report_type: 2 }).sort({price_over : -1}))

    if (overPrice.length === 0)
        return ctx.reply(user, 'nothing found for fraud report 2!')

    return ctx.sendPgn(ctx, user, {
        pages: await paginateOverPrice(ctx, user, overPrice),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, open report 2 audits: (${numFmt(overPrice.length)} results)` },
            color: colors.blue,
        }
    })
}))

pcmd(['admin', 'auditor'], ['audit', 'report', 'three'], withInteraction( async (ctx, user) => {
    let buybacks = await Audit.find({audited: false, report_type: 3}).sort({price: -1})

    if (buybacks.length === 0)
        return ctx.reply(user, 'nothing found for fraud report 3!')

    return ctx.sendPgn(ctx, user, {
        pages: await paginateRebuys(ctx, user, buybacks),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, open report 3 audits: (${numFmt(buybacks.length)} results)` },
            color: colors.blue,
        }
    })
}))

pcmd(['admin', 'auditor'], ['audit', 'report', 'four'], withInteraction( async (ctx, user) => {
    let buybacks = await Audit.find({audited: false, report_type: 4})

    if (buybacks.length === 0)
        return ctx.reply(user, 'nothing found for fraud report 4!')

    return ctx.sendPgn(ctx, user, {
        pages: await paginateRebuys(ctx, user, buybacks),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, open report 4 audits: (${numFmt(buybacks.length)} results)` },
            color: colors.blue,
        }
    })
}))

pcmd(['admin', 'auditor'], ['audit', 'report', 'five'], withInteraction( async (ctx, user) => {
    let botsells = await Audit.find({audited: false, report_type: 5})

    if (botsells.length === 0)
        return ctx.reply(user, 'nothing found for fraud report 5!')

    return ctx.sendPgn(ctx, user, {
        pages: await paginateBotSells(ctx, user, botsells),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, open report 5 audits: (${numFmt(botsells.length)} results)` },
            color: colors.blue,
        }
    })
}))

pcmd(['admin', 'auditor'], ['audit', 'user'], withInteraction( async (ctx, user, args) => {
    if (!args.ids[0])
        return ctx.reply(user, `please submit a valid user ID`, 'red')

    let search
    const auditedUser = await fetchOnly(args.ids[0])

    if (args.auctions) {
        if (args.from || args.to)
            search = args.from? {from_id: auditedUser.discord_id, status: 'auction'}: {to_id: auditedUser.discord_id, status: 'auction'}
        else
            search = {$or: [{to_id: auditedUser.discord_id}, {from_id: auditedUser.discord_id}], status: 'auction'}

    } else if (args.to || args.from) {
        search = args.to? {to_id: auditedUser.discord_id, $or: [{status: 'pending'}, {status: 'declined'}, {status: 'confirmed'}]}:
            {from_id: auditedUser.discord_id, $or: [{status: 'pending'}, {status: 'declined'}, {status: 'confirmed'}]}
    } else {
        search = {$or: [{to_id: auditedUser.discord_id}, {from_id: auditedUser.discord_id}]}
    }

    const list = await Transaction.find(search).sort({ time: -1 })

    if(!list)
        return ctx.reply(user, `there are no transactions found.`, 'red')

    return ctx.sendPgn(ctx, user, {
        pages: paginate_trslist(ctx, auditedUser, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, here are the results for ${auditedUser.username} (${numFmt(list.length)} results)` },
            color: colors.blue,
        }
    })
}))

pcmd(['admin', 'auditor'], ['audit', 'guild'], withInteraction( async (ctx, user, args) => {
    let search
    if (!args.guildID)
        return ctx.reply(user, `please submit a valid guild ID`, 'red')

    args.auctions? search = {status: 'auction', guild_id: args.guildID}: search = {guild_id: args.guildID, $or:[{status: 'pending'}, {status: 'declined'}, {status: 'confirmed'}]}

    let list = await Transaction.find(search).sort({ time :-1})

    if(!list)
        return ctx.reply(user, `there are no transactions found.`, 'red')


    return ctx.sendPgn(ctx, user, {
        pages: paginateGuildTrsList(ctx, user, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, here are the guild transactions for \`${args.guildID}\` (${list.length} results)` },
            color: colors.blue,
        }
    })
}))

pcmd(['admin', 'auditor'], ['audit', 'transaction'], withInteraction( async (ctx, user, args) => {
    let trans = await Transaction.findOne({id: args.transID})

    if (!trans)
        return ctx.reply(user, `transaction ID \`${args.transID}\` was not found`, 'red')

    const timediff = msToTime(new Date() - trans.time, {compact: true})
    const corespAudit = await Audit.findOne({transid: args.transID})

    const resp = []
    resp.push(`Price: **${numFmt(trans.price)}** ${ctx.symbols.tomato}`)
    resp.push(`From: **${trans.from}** \`${trans.from_id}\``)
    resp.push(`To: **${trans.to}** \`${trans.to_id}\``)
    resp.push(`On server: **${trans.guild}** \`${trans.guild_id}\``)
    resp.push(`Status: **\`${ch_map[trans.status]}\` ${trans.status}**`)

    resp.push(`Date: **${trans.time}**`)

    return ctx.sendPgn(ctx, user, {
        pages: ctx.pgn.getPages(trans.cards.map(c => formatName(ctx.cards[c])), 10, 1024),
        switchPage: (data) => data.embed.fields[0].value = data.pages[data.pagenum],
        embed : {
            title: `Transaction [${trans.id}] (${timediff})  ${corespAudit ? `Audit ID: ${corespAudit.audit_id}` : ''}`,
            description: resp.join('\n'),
            color: colors['blue'],
            fields: [{
                name: "Cards",
                value: ""
            }]
        }

    })
}))

pcmd(['admin', 'auditor'], ['audit', 'warn'], withInteraction( async (ctx, user, args) => {
    let warnedUser = await fetchOnly(args.ids[0])

    if (!warnedUser)
        return ctx.reply(user, `user with ID ${args.ids[0]} not found`, 'red')

    try {
        const ch = await ctx.bot.getDMChannel(args.ids[0])
        let embed = {
            title: "**Rule Violation Warning**",
            description: `${args.extraArgs}`,
            color: colors['yellow']
        }
        await ctx.direct(warnedUser, embed)
    } catch(e) {
        return ctx.reply(user, `insufficient permissions to send a DM message. Warning message not sent.`, 'red')
    }

    return ctx.reply(user, "Warning message sent")
}))

pcmd(['admin', 'auditor'], ['audit', 'auc'], ['audit', 'auction'], withInteraction( async (ctx, user, args) => {
    const auc = await Auction.findOne({ id: args.aucID })

    if(!auc)
        return ctx.reply(user, `auction with ID \`${args.aucID}\` was not found`, 'red')

    const author = await fetchOnly(auc.author)
    const card = ctx.cards[auc.card]
    const timediff = msToTime(auc.expires - new Date(), {compact: true})
    const corespAudit = await Audit.findOne({id: args.aucID})

    const resp = []

    resp.push(`Seller: **${author.username}** \`${author.discord_id}\``)
    resp.push(`Price: **${numFmt(auc.price)}** ${ctx.symbols.tomato}`)
    resp.push(`Card: ${formatName(card)}`)
    resp.push(`Card value: **${await evalCard(ctx, card)}** ${ctx.symbols.tomato}`)

    if(auc.finished)
        resp.push(`**This auction has finished! Finished at ${dateFormat(auc.expires, "yyyy-mm-dd HH:MM:ss")}**`)
    else
        resp.push(`Expires in **${timediff}**`)

    let bids = auc.bids.sort((a, b) => b.time - a.time)
    const pages = []
    if (bids.length == 0) {
        pages.push("There are no current bids")
    }


    bids.map((t, i) => {
        if (i % 8 == 0) pages.push("")
        pages[Math.floor(i/8)] += `${formatAucBidList(ctx, user, t)}\n`
    })

    const embed = {
        author: {name: `Auction [${auc.id}] ${corespAudit? `Audit ID: ${corespAudit.audit_id}`: ''}`},
        image: { url: card.url },
        description: resp.join('\n'),
        color: colors['blue'],
        fields: []
    }

    return ctx.sendPgn(ctx, user, {
        pages,embed,
        buttons: ['back', 'forward'],
        switchPage: (data) => data.embed.fields[0] = { name: `Auction Bids`, value: data.pages[data.pagenum] }
    }, user.discord_id)
}))

pcmd(['admin', 'auditor'], ['audit', 'find', 'user'], withInteraction( async (ctx, user, args) => {
    if (!args.ids[0])
        return ctx.reply(user, `please submit a valid user ID`, 'red')

    const findUser = await User.findOne({discord_id: args.ids[0]})

    if (!findUser)
        return ctx.reply(user, 'no user found with that ID', 'red')

    let embed = createFindUserEmbed(ctx, user, findUser)

    return ctx.send(ctx.interaction, embed, user.discord_id)
}))

pcmd(['admin', 'auditor'], ['audit', 'find', 'obj'], ['audit', 'find', 'object'], withInteraction( async (ctx, user, args) => {
    if (!args.extraArgs)
        return ctx.reply(user, `please submit a valid user ID`, 'red')

    const findUser = await User.findOne({_id: args.extraArgs})

    if (!findUser)
        return ctx.reply(user, 'no user found with that ID', 'red')

    let embed = createFindUserEmbed(ctx, user, findUser)

    return ctx.send(ctx.interaction, embed, user.discord_id)
}))

//Todo: Make work
pcmd(['admin', 'auditor'], ['audit', 'find', 'trans'], withInteraction( withGlobalCards(async (ctx, user, cards, args) => {
    const list = await Transaction.find({
        $or: [{to_id: args.ids}, {from_id: args.ids}], card: { $in: cards.map(c => c.id) }
    }).sort({ time: -1 }).limit(100)

    if(list.length == 0)
        return ctx.reply(user, `No matches found`, 'red')

    return ctx.sendPgn(ctx, user, {
        pages: paginateGuildTrsList(ctx, user, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, matched ${cards.length} cards and ${numFmt(list.length)} transactions` },
            color: colors.blue,
        }
    })
})))

pcmd(['admin', 'auditor'], ['audit', 'complete'], ['audit', 'confirm'], ['audit', 'cfm'], withInteraction( async (ctx, user, arg) => {
    if (!arg.extraArgs)
        return ctx.reply(user, `please submit a valid audit ID`, 'red')

    const auditEntry = await Audit.findOne({audit_id: arg.extraArgs, audited: false})
    
    if (!auditEntry)
        return ctx.reply(user, `no audit record found with that ID or it is already completed`, `red`)

    auditEntry.audited = true
    auditEntry.closedBy = user.username
    await auditEntry.save()
    return ctx.reply(user, `audit record with ID ${arg.extraArgs} has been confirmed as audited`)
}))

pcmd(['admin', 'auditor'], ['audit', 'closed'], withInteraction( async (ctx, user, arg) => {
    const closedAudits = await Audit.find({audited: true}).sort({ _id: -1})

    if (closedAudits.length === 0)
        return ctx.reply(user, 'No closed audits found', 'red')

    return ctx.sendPgn(ctx, user, {
        pages: paginateCompletedAuditList(ctx, user, closedAudits),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, here are the closed audits. (${closedAudits.length} results)` },
            color: colors.blue,
        }
    })
}))

pcmd(['admin', 'auditor'], ['audit', 'list'], withInteraction( async (ctx, user, args) => {
    if (!args.ids[0])
        return ctx.reply(user, `please submit a valid user ID`, 'red')

    const findUser = await User.findOne({discord_id: args.ids[0]})
    const userCards = await getUserCards(ctx, findUser)
    const now = new Date()
    let findCards = filter(mapUserCards(ctx, userCards).sort(args.sort), args)

    const cardstr = findCards.map(c => {
        const isnew = c.obtained > (findUser.lastdaily || now)
        return (isnew? '**[new]** ' : '') + formatName(c) + (c.amount > 1? ` (x${c.amount}) ` : ' ') + (c.rating? `[${c.rating}/10]` : '')
    })

    return ctx.sendPgn(ctx, user, {
        pages: ctx.pgn.getPages(cardstr, 15),
        embed: { author: { name: `${user.username}, here are ${findUser.username}'s cards (${numFmt(findCards.length)} results)` } }
    })
}))
