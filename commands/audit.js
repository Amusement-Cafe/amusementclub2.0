const {pcmd}                    = require('../utils/cmd')
const {evalCard}                = require('../modules/eval')
const {getHelpEmbed}            = require('../commands/misc')
const {fetchOnly}               = require('../modules/user')
const {numFmt}                  = require('../utils/tools')
const colors                    = require('../utils/colors')
const msToTime                  = require('pretty-ms')
const dateFormat                = require(`dateformat`)

const {
    paginate_trslist,
    ch_map,
} = require('../modules/transaction')

const {
    filter,
    formatName,
    mapUserCards,
    parseArgs,
    withGlobalCards,
}   = require('../modules/card')

const {
    auditFetchUserTags,
    createFindUserEmbed,
    formatAucBidList,
    paginateBotSells,
    paginateCompletedAuditList,
    paginateGuildTrsList,
    paginateOversells,
    paginateOverPrice,
    paginateRebuys,
    parseAuditArgs,
}   = require("../modules/audit");

const {
    Audit,
    AuditAucSell,
    Auction,
    Transaction,
    User
}     = require('../collections')

pcmd(['admin', 'auditor'], ['audit', 'help'], async (ctx, user, ...args) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    const help = ctx.audithelp.find(x => x.type === 'audit')
    const curpgn = getHelpEmbed(ctx, help, ctx.guild.prefix)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, curpgn)
})

pcmd(['admin', 'auditor'], ['fraud', 'report'], async (ctx, user) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    const help = ctx.audithelp.find(x => x.type === 'audit')
    const curpgn = getHelpEmbed(ctx, help, ctx.guild.prefix)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, curpgn)

})

pcmd(['admin', 'auditor'], ['fraud', 'report', '1'], async (ctx, user, ...args) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    let overSell = await AuditAucSell.find({sold: {$gt:5}}).sort({sold: -1, unsold: 1})

    if (overSell.length === 0)
        return ctx.reply(user, 'nothing found for fraud report 1!')

    return  ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: await paginateOversells(ctx, user, overSell),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, open report 1 audits: (${numFmt(overSell.length)} results)` },
            color: colors.blue,
        }
    })
})

pcmd(['admin', 'auditor'], ['fraud', 'report', '2'], async (ctx, user, ...args) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    let overPrice = (await Audit.find({ audited: false, report_type: 2 }).sort({price_over : -1}))

    if (overPrice.length === 0)
        return ctx.reply(user, 'nothing found for fraud report 2!')

    return  ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: await paginateOverPrice(ctx, user, overPrice),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, open report 2 audits: (${numFmt(overPrice.length)} results)` },
            color: colors.blue,
        }
    })
})

pcmd(['admin', 'auditor'], ['fraud', 'report', '3'], async (ctx, user, ...args) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    let buybacks = await Audit.find({audited: false, report_type: 3}).sort({price: -1})

    if (buybacks.length === 0)
        return ctx.reply(user, 'nothing found for fraud report 3!')

    return  ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: await paginateRebuys(ctx, user, buybacks),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, open report 3 audits: (${numFmt(buybacks.length)} results)` },
            color: colors.blue,
        }
    })
})

pcmd(['admin', 'auditor'], ['fraud', 'report', '4'], async (ctx, user, ...args) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    let buybacks = await Audit.find({audited: false, report_type: 4})

    if (buybacks.length === 0)
        return ctx.reply(user, 'nothing found for fraud report 4!')

    return  ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: await paginateRebuys(ctx, user, buybacks),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, open report 4 audits: (${numFmt(buybacks.length)} results)` },
            color: colors.blue,
        }
    })
})

pcmd(['admin', 'auditor'], ['fraud', 'report', '5'], async (ctx, user, ...args) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    let botsells = await Audit.find({audited: false, report_type: 5})

    if (botsells.length === 0)
        return ctx.reply(user, 'nothing found for fraud report 5!')

    return  ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: await paginateBotSells(ctx, user, botsells),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, open report 5 audits: (${numFmt(botsells.length)} results)` },
            color: colors.blue,
        }
    })
})

pcmd(['admin', 'auditor'], ['audit'], async (ctx, user, ...args) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    const help = ctx.audithelp.find(x => x.type === 'audit')
    const curpgn = getHelpEmbed(ctx, help, ctx.guild.prefix)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, curpgn)
})

pcmd(['admin', 'auditor'], ['audit', 'user'], async (ctx, user, ...args) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')
    let arg = parseAuditArgs(ctx, args)

    let search
    const auditedUser = await fetchOnly(arg.id)

    if (!arg.id)
        return ctx.reply(user, `please submit a valid user ID`, 'red')

    if (arg.auction) {
        if (arg.sends || arg.gets)
            search = arg.sends? {from_id: auditedUser.discord_id, status: 'auction'}: {to_id: auditedUser.discord_id, status: 'auction'}
        else
            search = {$or: [{to_id: auditedUser.discord_id}, {from_id: auditedUser.discord_id}], status: 'auction'}

    } else if (arg.gets || arg.sends) {
        search = arg.gets? {to_id: auditedUser.discord_id, $or: [{status: 'pending'}, {status: 'declined'}, {status: 'confirmed'}]}:
            {from_id: auditedUser.discord_id, $or: [{status: 'pending'}, {status: 'declined'}, {status: 'confirmed'}]}
    } else {
        search = {$or: [{to_id: auditedUser.discord_id}, {from_id: auditedUser.discord_id}]}
    }

    const list = await Transaction.find(search).sort({ time: -1 })

    if(!list)
        return ctx.reply(user, `there are no transactions found.`, 'red')

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: paginate_trslist(ctx, auditedUser, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, here are the results for ${auditedUser.username} (${numFmt(list.length)} results)` },
            color: colors.blue,
        }
    })
})

pcmd(['admin', 'mod', 'auditor', 'tagmod'], ['audit', 'user', 'tags'], withGlobalCards(async (ctx, user, cards, arg, fullArgs) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    if (!arg.ids)
        return ctx.reply(user, `please submit a valid user ID`, 'red')

    const auditedUser = await fetchOnly(arg.ids)
    const auditArgs = parseAuditArgs(ctx, fullArgs)
    const userTags = await auditFetchUserTags(auditedUser, auditArgs)
    const cardIDs = cards.map(x => x.id)
    const tags = userTags.filter(x => cardIDs.includes(x.card))

    if(tags.length === 0)
        return ctx.reply(user, `cannot find tags for matching cards (${cards.length} cards matched)`)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(tags.map(x => {
            const card = ctx.cards[x.card]
            return `\`${ctx.symbols.accept}${x.upvotes.length} ${ctx.symbols.decline}${x.downvotes.length}\` **#${x.name}** ${x.status!='clear'? `(${x.status})`: ''} - ${formatName(card)}`
        }, 10)),
        switchPage: (data) => data.embed.description = `**${user.username}**, tags that ${auditedUser.username} created:\n\n${data.pages[data.pagenum]}`,
        buttons: ['first', 'back', 'forward', 'last'],
        embed: {
            color: colors.blue,
        }
    })
}))

pcmd(['admin', 'auditor'], ['audit', 'guild'], async (ctx, user, ...args) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')
    let arg = parseAuditArgs(ctx, args)
    let search
    if (!arg.id)
        return ctx.reply(user, `please submit a valid guild ID`, 'red')

    arg.auction? search = {status: 'auction', guild_id: arg.id}: search = {guild_id: arg.id, $or:[{status: 'pending'}, {status: 'declined'}, {status: 'confirmed'}]}

    let list = await Transaction.find(search).sort({ time :-1})

    if(!list)
        return ctx.reply(user, `there are no transactions found.`, 'red')


    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: paginate_guildtrslist(ctx, user, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, here are the guild transactions for \`${arg.id}\` (${list.length} results)` },
            color: colors.blue,
        }
    })
})

pcmd(['admin', 'auditor'], ['audit', 'trans'], async (ctx, user, ...arg) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')
    let trans = await Transaction.findOne({id: arg[0]})

    if (!trans)
        return ctx.reply(user, `transaction ID \`${arg[0]}\` was not found`, 'red')

    const timediff = msToTime(new Date() - trans.time, {compact: true})
    const corespAudit = await Audit.findOne({transid: arg[0]})

    const resp = []
    resp.push(`Price: **${numFmt(trans.price)}** ${ctx.symbols.tomato}`)
    resp.push(`From: **${trans.from}** \`${trans.from_id}\``)
    resp.push(`To: **${trans.to}** \`${trans.to_id}\``)
    resp.push(`On server: **${trans.guild}** \`${trans.guild_id}\``)
    resp.push(`Status: **\`${ch_map[trans.status]}\` ${trans.status}**`)

    resp.push(`Date: **${trans.time}**`)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(trans.cards.map(c => formatName(ctx.cards[c])), 10),
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
})

pcmd(['admin', 'auditor'], ['audit', 'warn'], async (ctx, user, ...args) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')
    let arg = parseAuditArgs(ctx, ctx.capitalMsg)
    let warnedUser = await fetchOnly(arg.id)

    if (!warnedUser)
        return ctx.reply(user, `user with ID ${arg.id} not found`, 'red')

    try {
        const ch = await ctx.bot.getDMChannel(arg.id)
        let embed = {
            title: "**Rule Violation Warning**",
            description: `**${warnedUser.username}**, ${arg.extraArgs.join(" ")}`,
            color: colors['yellow']
        }
        await ctx.send(ch.id, embed, user.discord_id)
    } catch(e) {
        return ctx.reply(user, `insufficient permissions to send a DM message. Warning message not sent.`, 'red')
    }

    return ctx.reply(user, "Warning message sent")
})

pcmd(['admin', 'auditor'], ['audit', 'auc'], ['audit', 'auction'], async (ctx, user, ...args) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')
    const auc = await Auction.findOne({ id: args[0] })

    if(!auc)
        return ctx.reply(user, `auction with ID \`${args[0]}\` was not found`, 'red')

    const author = await fetchOnly(auc.author)
    const card = ctx.cards[auc.card]
    const timediff = msToTime(auc.expires - new Date(), {compact: true})
    const corespAudit = await Audit.findOne({id: args[0]})

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

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages,embed,
        buttons: ['back', 'forward'],
        switchPage: (data) => data.embed.fields[0] = { name: `Auction Bids`, value: data.pages[data.pagenum] }
    }, user.discord_id)
})

pcmd(['admin', 'auditor'], ['audit', 'find', 'user'], async (ctx, user, ...args) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')
    let arg = parseAuditArgs(ctx, args)
    if (!arg.id)
        return ctx.reply(user, `please submit a valid user ID`, 'red')

    const findUser = await User.findOne({discord_id: arg.id})

    if (!findUser)
        return ctx.reply(user, 'no user found with that ID', 'red')

    let embed = createFindUserEmbed(ctx, user, findUser)

    return ctx.send(ctx.msg.channel.id, embed, user.discord_id)
})

pcmd(['admin', 'auditor'], ['audit', 'find', 'obj'], ['audit', 'find', 'object'], async (ctx, user, ...args) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')
    let arg = parseAuditArgs(ctx, args)
    if (!arg.extraArgs)
        return ctx.reply(user, `please submit a valid user ID`, 'red')

    const findUser = await User.findOne({_id: arg.extraArgs[0]})

    if (!findUser)
        return ctx.reply(user, 'no user found with that ID', 'red')

    let embed = createFindUserEmbed(ctx, user, findUser)

    return ctx.send(ctx.msg.channel.id, embed, user.discord_id)
})

pcmd(['admin', 'auditor'], ['audit', 'find', 'trans'], withGlobalCards(async (ctx, user, cards, ...args) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    const list = await Transaction.find({
        $or: [{to_id: args[0].ids}, {from_id: args[0].ids}], card: { $in: cards.map(c => c.id) }
    }).sort({ time: -1 }).limit(100)

    if(list.length == 0)
        return ctx.reply(user, `No matches found`, 'red')

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: paginateGuildTrsList(ctx, user, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, matched ${cards.length} cards and ${numFmt(list.length)} transactions` },
            color: colors.blue,
        }
    })
}))

pcmd(['admin', 'auditor'], ['audit', 'complete'], ['audit', 'confirm'], ['audit', 'cfm'], async (ctx, user, arg) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    if (!arg)
        return ctx.reply(user, `please submit a valid audit ID`, 'red')

    const auditEntry = await Audit.findOne({audit_id: arg, audited: false})
    
    if (!auditEntry)
        return ctx.reply(user, `no audit record found with that ID or it is already completed`, `red`)

    auditEntry.audited = true
    auditEntry.closedBy = user.username
    await auditEntry.save()
    return ctx.reply(user, `audit record with ID ${arg} has been confirmed as audited`)
})

pcmd(['admin', 'auditor'], ['audit', 'closed'], async (ctx, user, arg) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'this command can only be run in an audit channel.', 'red')

    const closedAudits = await Audit.find({audited: true}).sort({ _id: -1})

    if (closedAudits.length === 0)
        return ctx.reply(user, 'No closed audits found', 'red')

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: paginateCompletedAuditList(ctx, user, closedAudits),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, here are the closed audits. (${closedAudits.length} results)` },
            color: colors.blue,
        }
    })
})

pcmd(['admin', 'auditor'], ['audit', 'list'], ['audit', 'li'], ['audit', 'cards'], ['audit', 'ls'], async (ctx, user, ...args) => {
    if (!ctx.audit.channel.includes(ctx.msg.channel.id))
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    let arg = parseArgs(ctx, args)
    if (!arg.ids)
        return ctx.reply(user, `please submit a valid user ID`, 'red')

    const findUser = await User.findOne({discord_id: arg.ids[0]})
    const now = new Date()
    let findCards = filter(mapUserCards(ctx, findUser).sort(arg.sort), arg)

    const cardstr = findCards.map(c => {
        const isnew = c.obtained > (findUser.lastdaily || now)
        return (isnew? '**[new]** ' : '') + formatName(c) + (c.amount > 1? ` (x${c.amount}) ` : ' ') + (c.rating? `[${c.rating}/10]` : '')
    })

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(cardstr, 15),
        embed: { author: { name: `${user.username}, here are ${findUser.username}'s cards (${numFmt(findCards.length)} results)` } }
    })
})
