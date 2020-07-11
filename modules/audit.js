const Auction            = require('../collections/auction')
const Audit              = require('../collections/audit')
const AuditAucSell       = require('../collections/auditAucSell')
const Transaction        = require('../collections/transaction')

const asdate             = require('add-subtract-date')
const colors             = require('../utils/colors')

const msToTime           = require('pretty-ms')
const {paginate_trslist, ch_map} = require('./transaction')
const {evalCard}         = require('./eval')
const {fetchOnly}        = require('./user')
const {formatName}       = require('./card')
const {tryGetUserID}     = require('../utils/tools')
const {onUsersFromArgs}  = require('../modules/user')


const cleanAudits = async (ctx, now) => {
    const auditcleanup = asdate.subtract(new Date(), 21, 'days')
    await Audit.deleteMany({time: {$lt: auditcleanup}})
    await AuditAucSell.deleteMany({time: {$lt: auditcleanup}})
}

const auditUser = async (ctx, user, args) => {
    let arg = parseAuditArgs(ctx, args)

    let search
    const auditedUser = await fetchOnly(arg.id)

    if (!arg.id)
        return ctx.reply(user, `please submit a valid guild ID`, 'red')

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
}

const auditGuild = async (ctx, user, args) => {
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
}

const auditAuc = async (ctx, user, arg) => {
    const auc = await Auction.findOne({ id: arg[0] })

    if(!auc)
        return ctx.reply(user, `auction with ID \`${arg[0]}\` was not found`, 'red')

    const author = await fetchOnly(auc.author)
    const card = ctx.cards[auc.card]
    const timediff = msToTime(auc.expires - new Date(), {compact: true})

    const resp = []
    resp.push(`Seller: **${author.username}**`)
    resp.push(`Price: **${auc.price}** ${ctx.symbols.tomato}`)
    resp.push(`Card: ${formatName(card)}`)
    resp.push(`Card value: **${await evalCard(ctx, card)}** ${ctx.symbols.tomato}`)

    if(auc.finished)
        resp.push(`**This auction has finished**`)
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

}

// This is basically a dupe of the normal trans info, but without the check for if the command runner is in either from or to
const auditTrans = async (ctx, user, arg) => {
    let trans = await Transaction.findOne({id: arg[0]})

    if (!trans)
        return ctx.reply(user, `transaction ID \`${arg[0]}\` was not found`, 'red')

    const card = ctx.cards[trans.card]
    const timediff = msToTime(new Date() - trans.time, {compact: true})

    const resp = []
    resp.push(`Card: ${formatName(card)}`)
    resp.push(`Price: **${trans.price}** ${ctx.symbols.tomato}`)
    resp.push(`From: **${trans.from}**`)
    resp.push(`To: **${trans.to}**`)

    if(trans.guild) {
        resp.push(`On server: **${trans.guild}**`)
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

}

const paginate_auditReports = (ctx, user, list, report) => {
    const pages = []
    switch (report) {
        case 1:
            list.map((t, i) => {
                if (i % 10 == 0) pages.push("")
                pages[Math.floor(i/10)] += `${format_overSell(ctx, user, t)}\n`
            })
            break
        case 2:
            list.map((t, i) => {
                if (i % 10 == 0) pages.push("")
                pages[Math.floor(i/10)] += `${format_overPrice(ctx, user, t)}\n`
            })
            break
        case 3:
            list.map((t, i) => {
                if (i % 10 == 0) pages.push("")
                pages[Math.floor(i/10)] += `${format_rebuys(ctx, user, t)}\n`
            })
            break
    }

    return pages;
}

const paginate_guildtrslist = (ctx, user, list) => {
    const pages = []
    list.map((t, i) => {
        if (i % 10 == 0) pages.push("")
        pages[Math.floor(i/10)] += `${formatGuildTrsList(ctx, user, t)}\n`
    })
    return pages;
}

const format_overSell = (ctx, user, auc) => {
    let resp = ""
    let sellPerc = (auc.sold / (auc.sold + auc.unsold)) * 100
    resp += `${auc.name}, \`${auc.user}\` has ${auc.sold} sold and ${auc.unsold} unsold auctions, Sell Percentage is ${sellPerc.toLocaleString('en-us', {maximumFractionDigits: 2})}%`

    return resp;
}

const format_overPrice = (ctx, user, auc) => {
    let resp = ""

    resp += `**${auc.id}** sold \`${auc.card}\` for ${auc.price_over.toLocaleString('en-us', {maximumFractionDigits: 2})}x eval of ${auc.eval} with ${auc.price} finishing in ${auc.bids} bids`

    return resp;
}

const format_rebuys = (ctx, user, auc) => {
    let resp = ""

    resp += `${auc.user} sold ${auc.card} on auction at \`${auc.id}\` for ${auc.price} and bought it back for ${auc.transprice} at ${auc.transid} `

    return resp;
}

const formatGuildTrsList = (ctx, user, gtrans) => {
    let resp = ""
    const timediff = msToTime(new Date() - gtrans.time, {compact: true})

    resp += `[${timediff}] ${ch_map[gtrans.status]} \`${gtrans.id}\` ${formatName(ctx.cards[gtrans.card])}`
    resp += `**${gtrans.from}** \`->\` **${gtrans.to}**`
    return resp;
}

const formatAucBidList = (ctx, user, bids) => {
    let resp = ""
    resp += `${bids.bid}${ctx.symbols.tomato}, \`${bids.user}\`, ${bids.time}`
    return resp;
}

const messageLift = async (ctx, target) => {
    return ctx.direct(target, "Your embargo has been lifted, you may now return to normal bot usage. Please try to follow the rules, they can easily be found at \`->rules\`")
}

const auditWarn = async (ctx, user, args) => {
    let arg = parseAuditArgs(ctx, args)
    let warnedUser = await fetchOnly(arg.id)
    await ctx.direct(warnedUser, arg.extraArgs.join(` `))
    return ctx.reply(user, "Warning message sent")
}

const parseAuditArgs = (ctx, args) => {
    const a = {
        id: '',
        auction: false,
        gets: false,
        sends: false,
        extraArgs: []
    }

    args.map( x => {
        switch (x) {
            case 'auction':
                a.auction = true
                break
            case 'gets':
                a.gets = true
                break
            case 'sends':
                a.sends = true
                break
            default:
                const tryid = tryGetUserID(x)
                if(tryid && !a.id) a.id = x
                else a.extraArgs.push(x)
        }
    })
    return a

}

module.exports = {
    paginate_auditReports,
    cleanAudits,
    auditUser,
    auditAuc,
    auditGuild,
    auditTrans,
    auditWarn,
    messageLift,
}
