const asdate             = require('add-subtract-date')
const dateFormat         = require(`dateformat`)
const msToTime           = require('pretty-ms')
const {ch_map}           = require('./transaction')
const {formatName}       = require('./card')
const {byAlias}          = require('./collection')

const {
    generateNextId,
    tryGetUserID,
} = require('../utils/tools')

const {
    Audit,
    AuditAucSell,
    Auction,
    Tag,
    Transaction,
} = require('../collections')



const clean_audits = async (ctx, now) => {
    const auditcleanup = asdate.subtract(new Date(), 10, 'days')
    const auditClean = await Audit.deleteMany({time: {$lt: auditcleanup}})
    const auditAucSellClean = await AuditAucSell.deleteMany({time: {$lt: auditcleanup}})
    if (auditClean.n > 0 || auditAucSellClean.n > 0)
        console.log(`Cleaned ${auditClean.n} audit entries and ${auditAucSellClean.n} oversell entries`)
}

const trans_fraud_check = async (ctx, user, trans, card) => {
    const auditCheck = await Auction.findOne({ author: trans.to_id, card: card,  "bids.0": { $exists: true }})
    const buyCheck = await Transaction.findOne({to_id: trans.from_id, cards: {$in: [card]}})
    const last_audit = (await Audit.find().sort({ _id: -1 }))[0]
    if (auditCheck) {
        const auditDB = await new Audit()
        auditDB.audit_id = audit_ID_gen(last_audit)
        auditDB.report_type = auditCheck.lastbidder === trans.from_id? 4:3
        auditDB.transid = trans.id
        auditDB.id = auditCheck.id
        auditDB.price = auditCheck.price
        auditDB.transprice =  trans.price
        auditDB.user = trans.to
        auditDB.card = card
        await auditDB.save()
    }
    if (buyCheck && trans.to_id === null) {
        const botSell = await new Audit()
        botSell.audit_id = audit_ID_gen(last_audit)
        botSell.report_type = 5
        botSell.transid = trans.id
        botSell.id = buyCheck.id
        botSell.user = trans.from
        botSell.card = card
        await botSell.save()
    }
    if (auditCheck && trans.to_id === null) {
        const botSells = await new Audit()
        botSells.audit_id = audit_ID_gen(last_audit)
        botSells.report_type = 5
        botSells.transid = trans.id
        botSells.id = auditCheck.id
        botSells.user = trans.from
        botSells.card = card
        await botSells.save()
    }
}

const eval_fraud_check = async (ctx, auc, eval, card) => {
    if (auc.price < eval * 4)
        return
    const last_audit = (await Audit.find().sort({ _id: -1 }))[0]
    const auditDB = await new Audit()
    auditDB.audit_id = audit_ID_gen(last_audit)
    auditDB.id = auc.id
    auditDB.card = card.name
    auditDB.bids = auc.bids.length
    auditDB.finished = auc.finished
    auditDB.eval = eval
    auditDB.price = auc.price
    auditDB.price_over = auc.price / eval
    auditDB.report_type = 2
    auditDB.time = new Date()
    await auditDB.save()
}

const audit_auc_stats = async (ctx, user, sold) => {
    const sellDB = await new AuditAucSell()
    sellDB.user = user.discord_id
    sellDB.name = user.username
    sold? sellDB.sold = 1: sellDB.unsold = 1
    sellDB.time = new Date()
    await sellDB.save()
}

const audit_ID_gen = (last_audit) => {
    if (!last_audit)
        return generateNextId('aaaaaaa', 7)

    return generateNextId(last_audit.audit_id, 7)

}

const paginate_auditReports = (ctx, user, list, report) => {
    const pages = []
    switch (report) {
        case 1:
            list.map((t, i) => {
                if (i % 10 == 0) pages.push("**Username | User ID | Sold | Unsold | Sell %**\n")
                pages[Math.floor(i/10)] += `${format_overSell(ctx, user, t)}\n`
            })
            break
        case 2:
            list.map((t, i) => {
                if (i % 10 == 0) pages.push("**Audit ID | Auc ID | Auc Amount | Over Eval X | Eval | Promo?**\n")
                pages[Math.floor(i/10)] += `${format_overPrice(ctx, user, t)}\n`
            })
            break
        case 3:
        case 4:
            list.map((t, i) => {
                if (i % 10 == 0) pages.push("**Audit ID | Auc ID | Auc Amount | Trans Id | Trans Amount | Promo?**\n")
                pages[Math.floor(i/10)] += `${format_rebuys(ctx, user, t)}\n`
            })
            break
        case 5:
            list.map((t, i) => {
                if (i % 10 == 0) pages.push("**Audit ID | Trans ID | Received ID | Username | Card **\n")
                pages[Math.floor(i/10)] += `${format_botsells(ctx, user, t)}\n`
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

const paginate_closedAudits = (ctx, user, list) => {
    const pages =[]
    list.map((t, i) => {
        if (i % 10 == 0) pages.push("")
        pages[Math.floor(i/10)] += `${formatCompletedList(ctx, user, t)}\n`
    })
    return pages;
}

const format_overSell = (ctx, user, auc) => {
    let resp = ""
    let sellPerc = (auc.sold / (auc.sold + auc.unsold)) * 100
    resp += `${auc.name} | \`${auc.user}\` | ${auc.sold} | ${auc.unsold} | ${sellPerc.toLocaleString('en-us', {maximumFractionDigits: 2})}%`

    return resp;
}

const format_botsells = (ctx, user, trans) => {
    return `\`${trans.audit_id}\` | ${trans.transid} | \`${trans.id}\` | ${trans.user} | ${formatName(ctx.cards[trans.card])}`;
}

const format_overPrice = (ctx, user, auc) => {
    let resp = ""
    let col
    if (!isNaN(auc.card[0]))
        col = byAlias(ctx, ctx.cards[auc.card[0]].col)[0]
    resp += `\`${auc.audit_id}\` | \`${auc.id}\` | **${auc.price}**${ctx.symbols.tomato} | ${auc.price_over.toLocaleString('en-us', {maximumFractionDigits: 2})} | ${auc.eval} | ${col? col.promo : 'false'} `

    return resp;
}

const format_rebuys = (ctx, user, auc) => {
    let resp = ""
    let col
    if (!isNaN(auc.card[0]))
        col = byAlias(ctx, ctx.cards[auc.card[0]].col)[0]

    resp += `\`${auc.audit_id}\` | \`${auc.id}\` | **${auc.price}**${ctx.symbols.tomato} | ${auc.transid} | **${auc.transprice}**${ctx.symbols.tomato} | ${col? col.promo : 'false'}`

    return resp;
}

const formatGuildTrsList = (ctx, user, gtrans) => {
    let resp = ""
    const timediff = msToTime(new Date() - gtrans.time, {compact: true})

    resp += `[${timediff}] ${ch_map[gtrans.status]} \`${gtrans.id}\` ${gtrans.cards.length} card(s) **${gtrans.from}** \`->\` **${gtrans.to}**`
    return resp;
}

const formatAucBidList = (ctx, user, bids) => {
    let resp = ""
    resp += `${bids.bid}${ctx.symbols.tomato}, \`${bids.user}\`, ${dateFormat(bids.time, "yyyy-mm-dd HH:MM:ss")}`
    return resp;
}

const formatCompletedList = (ctx, user, audit) => {
    let resp = ""
    resp += `\`${audit.audit_id}\` closed by ${audit.closedBy}, Report Type ${audit.report_type}`
    return resp;
}

const auditFetchUserTags = async (user, args) => {
    let res = await Tag.find({ author: user.discord_id })
    let tagList = []
    if (args.tagQuery) {
        if (args.clear !== 0) {
            args.clear === 1 ? res.map(x => x.status === 'clear'? tagList.includes(x)? null: tagList.push(x) : null) : res.map(x => x.status !== 'clear'? tagList.includes(x)? null: tagList.push(x) : null)
        }
        if (args.banned !== 0) {
            args.banned === 1 ? res.map(x => x.status === 'banned'? tagList.includes(x)? null: tagList.push(x) : null) : res.map(x => x.status !== 'banned'? tagList.includes(x)? null: tagList.push(x) : null)
        }
        if (args.removed !== 0) {
            args.removed === 1 ? res.map(x => x.status === 'removed'? tagList.includes(x)? null: tagList.push(x) : null) : res.map(x => x.status !== 'removed'? tagList.includes(x)? null: tagList.push(x) : null)
        }
    } else {
        tagList = res
    }

    return tagList.sort().reverse()
}

const parseAuditArgs = (ctx, args) => {
    const a = {
        id: '',
        auction: false,
        gets: false,
        sends: false,
        tagQuery: false,
        banned: 0,
        removed: 0,
        clear: 0,
        extraArgs: []
    }

    args.map( x => {
        if (x[0] === '!' || x[0] === '-') {
            let q = x[0] === '-'
            switch (x.substr(1)) {
                case 'clear': q? a.clear = 1: a.clear = 2; a.tagQuery = true; break
                case 'banned': q? a.banned = 1: a.banned = 2; a.tagQuery = true; break
                case 'removed': q? a.removed = 1: a.removed = 2; a.tagQuery = true; break
            }
        } else {
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
                    if(tryid && !a.id) a.id = tryid
                    else a.extraArgs.push(x)
            }
        }
    })
    return a

}


module.exports = {
    auditFetchUserTags,
    audit_auc_stats,
    eval_fraud_check,
    paginate_auditReports,
    paginate_guildtrslist,
    paginate_closedAudits,
    parseAuditArgs,
    clean_audits,
    formatAucBidList,
    formatGuildTrsList,
    trans_fraud_check
}
