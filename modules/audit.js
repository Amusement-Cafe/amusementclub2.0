const Audit              = require('../collections/audit')
const AuditAucSell       = require('../collections/auditAucSell')
const asdate             = require('add-subtract-date')
const dateFormat         = require(`dateformat`)
const msToTime           = require('pretty-ms')
const {ch_map} = require('./transaction')
const {formatName}       = require('./card')
const {tryGetUserID}     = require('../utils/tools')



const clean_audits = async (ctx, now) => {
    const auditcleanup = asdate.subtract(new Date(), 10, 'days')
    const auditClean = await Audit.deleteMany({time: {$lt: auditcleanup}})
    const auditAucSellClean = await AuditAucSell.deleteMany({time: {$lt: auditcleanup}})
    if (auditClean.n > 0 || auditAucSellClean.n > 0)
        console.log(`Cleaned ${auditClean.n} audit entries and ${auditAucSellClean.n} oversell entries`)
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
    resp += `${auc.name}, \`${auc.user}\` has ${auc.sold} sold and ${auc.unsold} unsold auctions, Sell% ${sellPerc.toLocaleString('en-us', {maximumFractionDigits: 2})}%`

    return resp;
}

const format_overPrice = (ctx, user, auc) => {
    let resp = ""

    resp += `AuditID: \`${auc.audit_id}\` **${auc.id}** sold \`${auc.card}\` for ${auc.price_over.toLocaleString('en-us', {maximumFractionDigits: 2})}x eval of ${auc.eval} with ${auc.price} finishing in ${auc.bids} bids`

    return resp;
}

const format_rebuys = (ctx, user, auc) => {
    let resp = ""

    resp += `AuditID: \`${auc.audit_id}\`, ${auc.user} sold ${auc.card} on auction at \`${auc.id}\` for ${auc.price} and bought it back for ${auc.transprice} at ${auc.transid}`

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
    resp += `${bids.bid}${ctx.symbols.tomato}, \`${bids.user}\`, ${dateFormat(bids.time, "yyyy-mm-dd HH:MM:ss")}`
    return resp;
}

const formatCompletedList = (ctx, user, audit) => {
    let resp = ""
    resp += `\`${audit.audit_id}\` closed by ${audit.closedBy}, Report Type ${audit.report_type}`
    return resp;
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
                if(tryid && !a.id) a.id = tryid
                else a.extraArgs.push(x)
        }
    })
    return a

}


module.exports = {
    paginate_auditReports,
    paginate_guildtrslist,
    paginate_closedAudits,
    parseAuditArgs,
    clean_audits,
    formatAucBidList,
    formatGuildTrsList
}
