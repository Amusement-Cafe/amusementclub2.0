const {pcmd}                    = require('../utils/cmd')
const {formatName}              = require('../modules/card')
const {evalCard}                = require('../modules/eval')
const {fetchOnly}               = require('../modules/user')
const colors                    = require('../utils/colors')
const msToTime                  = require('pretty-ms')
const {paginate_trslist, ch_map} = require('../modules/transaction')
const dateFormat                = require(`dateformat`)

const {
    formatAucBidList,
    paginate_auditReports,
    paginate_guildtrslist,
    paginate_closedAudits,
    parseAuditArgs
}   = require("../modules/audit");

const {
    Audit,
    AuditAucSell,
    Auction,
    Transaction,
    User
}     = require('../collections')


pcmd(['admin', 'auditor'], ['fraud', 'report'], async (ctx, user, ...args) => {
    if (ctx.msg.channel.id != ctx.audit.channel)
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')


    return ctx.reply(user, `**__Choose a fraud report__**
                            Fraud Report 1: Lists users who have more auction sales than returns
                            Fraud Report 2: Lists overpriced auctions
                            Fraud Report 3: Lists users who sold a card on auction and then bought the card back`)

})

pcmd(['admin', 'auditor'], ['fraud', 'report', '1'], async (ctx, user, ...args) => {
    if (ctx.msg.channel.id != ctx.audit.channel)
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    let overSell = await AuditAucSell.find({sold: {$gt:5}}).sort({sold: -1})

    return  ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: paginate_auditReports(ctx, user, overSell, 1),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, open report 1 audits: (${overSell.length} results)` },
            color: colors.blue,
        }
    })
})

pcmd(['admin', 'auditor'], ['fraud', 'report', '2'], async (ctx, user, ...args) => {
    if (ctx.msg.channel.id != ctx.audit.channel)
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    let overPrice = (await Audit.find({ audited: false, report_type: 2 }).sort({price_over : -1}))

    return  ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: paginate_auditReports(ctx, user, overPrice, 2),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, open report 2 audits: (${overPrice.length} results)` },
            color: colors.blue,
        }
    })
})

pcmd(['admin', 'auditor'], ['fraud', 'report', '3'], async (ctx, user, ...args) => {
    if (ctx.msg.channel.id != ctx.audit.channel)
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    let buybacks = await Audit.find({audited: false, report_type: 3}).sort({price: -1})

    return  ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: paginate_auditReports(ctx, user, buybacks, 3),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, open report 3 audits: (${buybacks.length} results)` },
            color: colors.blue,
        }
    })
})

pcmd(['admin', 'auditor'], ['audit'], async (ctx, user, ...args) => {
    if (ctx.msg.channel.id != ctx.audit.channel)
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    return ctx.reply(user, "Current audit options are: auction, guild, trans, user, warn")
})

pcmd(['admin', 'auditor'], ['audit', 'user'], async (ctx, user, ...args) => {
    if (ctx.msg.channel.id != ctx.audit.channel)
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')
    let arg = parseAuditArgs(ctx, args)

    let search
    const auditedUser = await fetchOnly(arg.id)

    if (!arg.id)
        return ctx.reply(user, `please submit a valid user ID`, 'red')

    if (arg.auction && arg.gets) {
        search = {to_id: auditedUser.discord_id, status: 'auction'}
    }
    else if (arg.auction && arg.sends) {
        search = {from_id: auditedUser.discord_id, status: 'auction'}
    }
    else if (arg.auction) {
        search = {$or: [{to_id: auditedUser.discord_id}, {from_id: auditedUser.discord_id}], status: 'auction'}
    }
    else if (arg.gets) {
        search = {to_id: auditedUser.discord_id, $or: [{status: 'pending'}, {status: 'declined'}, {status: 'confirmed'}]}
    }
    else if (arg.sends) {
        search = {from_id: auditedUser.discord_id, $or: [{status: 'pending'}, {status: 'declined'}, {status: 'confirmed'}]}
    }
    else {
        search = {$or: [{to_id: auditedUser.discord_id}, {from_id: auditedUser.discord_id}]}
    }

    const list = await Transaction.find(search).sort({ time: -1 })

    if(list.length == 0)
        return ctx.reply(user, `there are no transactions found.`, 'red')

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: paginate_trslist(ctx, auditedUser, list),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, here are the results for ${auditedUser.username} (${list.length} results)` },
            color: colors.blue,
        }
    })
})

pcmd(['admin', 'auditor'], ['audit', 'guild'], async (ctx, user, ...args) => {
    if (ctx.msg.channel.id != ctx.audit.channel)
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')
    let arg = parseAuditArgs(ctx, args)
    let search
    if (!arg.id)
        return ctx.reply(user, `please submit a valid guild ID`, 'red')

    arg.auction? search = {status: 'auction', guild_id: arg.id}: search = {guild_id: arg.id, $or:[{status: 'pending'}, {status: 'declined'}, {status: 'confirmed'}]}

    let list = await Transaction.find(search).sort({ time :-1})

    if(list.length == 0)
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
    if (ctx.msg.channel.id != ctx.audit.channel)
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')
    let trans = await Transaction.findOne({id: arg[0]})

    if (!trans)
        return ctx.reply(user, `transaction ID \`${arg[0]}\` was not found`, 'red')

    const card = ctx.cards[trans.card]
    const timediff = msToTime(new Date() - trans.time, {compact: true})

    const resp = []
    resp.push(`Card: ${formatName(card)}`)
    resp.push(`Price: **${trans.price}** ${ctx.symbols.tomato}`)
    resp.push(`From: **${trans.from}** \`${trans.from_id}\``)
    resp.push(`To: **${trans.to}** \`${trans.to_id}\``)

    if(trans.guild) {
        resp.push(`On server: **${trans.guild}** \`${trans.guild_id}\``)
        resp.push(`Status: **\`${ch_map[trans.status]}\` ${trans.status}**`)
    } else {
        resp.push(`${ch_map[trans.status]} This is an **auction** transaction`)
    }

    resp.push(`Date: **${trans.time}**`)

    return ctx.send(ctx.msg.channel.id, {
        title: `Transaction [${trans.id}] (${timediff})`,
        image: { url: card.url },
        description: resp.join('\n'),
        color: colors['blue']
    }, user.discord_id)
})

pcmd(['admin', 'auditor'], ['audit', 'warn'], async (ctx, user, ...args) => {
    if (ctx.msg.channel.id != ctx.audit.channel)
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')
    let arg = parseAuditArgs(ctx, args)
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
    if (ctx.msg.channel.id != ctx.audit.channel)
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')
    const auc = await Auction.findOne({ id: args[0] })

    if(!auc)
        return ctx.reply(user, `auction with ID \`${args[0]}\` was not found`, 'red')

    const author = await fetchOnly(auc.author)
    const card = ctx.cards[auc.card]
    const timediff = msToTime(auc.expires - new Date(), {compact: true})

    const resp = []
    resp.push(`Seller: **${author.username}** \`${author.discord_id}\``)
    resp.push(`Price: **${auc.price}** ${ctx.symbols.tomato}`)
    resp.push(`Card: ${formatName(card)}`)
    resp.push(`Card value: **${await evalCard(ctx, card)}** ${ctx.symbols.tomato}`)

    if(auc.finished)
        resp.push(`**This auction has finished! Finished at ${dateFormat(auc.expires, "yyyy-mm-dd HH:MM:ss")}**`)
    else
        resp.push(`Expires in **${timediff}**`)

    let bids = auc.bids.sort((a, b) => b.time - a.time)
    const pages = []

    bids.map((t, i) => {
        if (i % 8 == 0) pages.push("")
        pages[Math.floor(i/8)] += `${formatAucBidList(ctx, user, t)}\n`
    })

    const embed = {
        author: {name: `Auction [${auc.id}]`},
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

pcmd(['admin', 'auditor'], ['audit', 'find'], async (ctx, user, ...args) => {
    if (ctx.msg.channel.id != ctx.audit.channel)
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')
    let arg = parseAuditArgs(ctx, args)
    if (!arg.id)
        return ctx.reply(user, `please submit a valid user ID`, 'red')

    const findUser = await User.findOne({discord_id: arg.id})

    if (findUser.length == 0)
        return ctx.reply(user, 'no user found with that ID', 'red')

    let effects = findUser.effects.map(x => x.id)

    let embed = {
        author: {name: `${user.username} here is the info for ${findUser.username}`},
        description: `**${findUser.username}** \`${findUser.discord_id}\`
                      Tomatoes: **${findUser.exp}${ctx.symbols.tomato}** 
                      Vials: **${findUser.vials}${ctx.symbols.vial}**
                      Promo Currency: **${findUser.promoexp}**
                      Last Daily: **${findUser.lastdaily}**
                      Unique Cards: **${findUser.cards.length}**
                      Completed Collections: **${findUser.completedcols? findUser.completedcols.length: 0}**
                      Effects List: **${effects.length != 0? effects: 0}**
                      __Daily Stats__: 
                      Claims: **${findUser.dailystats.claims? findUser.dailystats.claims: 0}**, Bids: **${findUser.dailystats.bids? findUser.dailystats.bids: 0}** Auctions: **${findUser.dailystats['aucs']? findUser.dailystats['aucs']: 0}**`,
        color: colors['green']
    }
    return ctx.send(ctx.msg.channel.id, embed, user.discord_id)
})

pcmd(['admin', 'auditor'], ['audit', 'complete'], ['audit', 'confirm'], async (ctx, user, arg) => {
    if (ctx.msg.channel.id != ctx.audit.channel)
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
    if (ctx.msg.channel.id != ctx.audit.channel)
        return ctx.reply(user, 'this command can only be run in an audit channel.', 'red')

    const closedAudits = await Audit.find({audited: true}).sort({ _id: -1})

    if (closedAudits.length == 0)
        return ctx.reply(user, 'No closed audits found', 'red')

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: paginate_closedAudits(ctx, user, closedAudits),
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, here are the closed audits. (${closedAudits.length} results)` },
            color: colors.blue,
        }
    })
})
