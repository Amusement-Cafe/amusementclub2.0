const asdate             = require('add-subtract-date')
const dateFormat         = require(`dateformat`)
const msToTime           = require('pretty-ms')
const {ch_map}           = require('./transaction')
const {formatName}       = require('./card')
const {byAlias}          = require('./collection')
const colors             = require('../utils/colors')

const {
    generateNextId,
    tryGetUserID,
    numFmt,
} = require('../utils/tools')

const {
    Audit,
    AuditAucSell,
    Auction,
    Tag,
    Transaction,
} = require('../collections')



const clean_audits = async (ctx, now) => {
    const auditcleanup = asdate.subtract(new Date(), 14, 'days')
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
        auditDB.audit_id = auditIDGen(last_audit)
        auditDB.report_type = auditCheck.lastbidder === trans.from_id? 4:3
        auditDB.transid = trans.id
        auditDB.id = auditCheck.id
        auditDB.price = auditCheck.price
        auditDB.transprice =  trans.price
        auditDB.user = trans.to
        auditDB.card = card
        await auditDB.save()
    }
    if ((buyCheck || auditCheck) && trans.to_id === null) {
        const botSell = await new Audit()
        botSell.audit_id = auditIDGen(last_audit)
        botSell.report_type = 5
        botSell.transid = trans.id
        botSell.id = buyCheck? buyCheck.id : auditCheck.id
        botSell.user = trans.from
        botSell.card = card
        await botSell.save()
    }
}

const eval_fraud_check = async (ctx, auc, eval, card) => {
    if (auc.price < eval * 4)
        return
    const last_audit = (await Audit.find().sort({ _id: -1 }))[0]
    const auditDB = await new Audit()
    auditDB.audit_id = auditIDGen(last_audit)
    auditDB.id = auc.id
    auditDB.card = card.name
    auditDB.bids = auc.bids.length
    auditDB.finished = auc.finished
    auditDB.eval = eval
    auditDB.price = auc.price
    auditDB.price_over = auc.price / eval
    auditDB.report_type = 2
    await auditDB.save()
}

const audit_auc_stats = async (ctx, user, sold) => {
    const sellDB = await new AuditAucSell()
    sellDB.user = user.discord_id
    sellDB.name = user.username
    sold? sellDB.sold = 1: sellDB.unsold = 1
    await sellDB.save()
}

const auditIDGen = (last_audit) => {
    if (!last_audit)
        return generateNextId('aaaaaaa', 7)

    return generateNextId(last_audit.audit_id, 7)

}



const paginateBotSells = async (ctx, user, list) => {
    let pages = []

    list.map((t, i) => {
        if (i % 10 == 0) pages.push("`Audit ID | Trans ID | Received ID | Username | Card`\n")
        const auditID = t.audit_id.padEnd(8)
        const transID = t.transid.padEnd(8)
        const receiveID = t.id.padEnd(11)
        const username = t.user.length > 8? t.user.substr(0, 7): t.user.padEnd(8)
        pages[Math.floor(i/10)] += `\`${auditID} | ${transID} | ${receiveID} | ${username} | ${ctx.cards[t.card].name}\`\n`
    })

    return pages
}

const paginateOversells = async (ctx, user, list) => {
    let pages = []

    list.map((t, i) => {
        if (i % 10 == 0) pages.push("`Username | Sold | Unsold | Sell % | User ID`\n")
        const username = t.name.padEnd(8)
        const sold = numFmt(t.sold).padEnd(4)
        const unsold = numFmt(t.unsold).padEnd(6)
        const sellPercentage = ((t.sold / (t.sold + t.unsold)) * 100).toLocaleString('en-us', {maximumFractionDigits: 2}).padEnd(6)

        pages[Math.floor(i/10)] += `\`${username} | ${sold} | ${unsold} | ${sellPercentage} | ${t.user}\`\n`
    })

    return pages
}

const paginateOverPrice = async (ctx, user, list) => {
    let pages = []

    list.map((t, i) => {
        if (i % 10 == 0) pages.push("`Audit ID | Auc ID | Auc Price | Eval    | X Eval | Promo?`\n")
        const auditID = t.audit_id.padEnd(8)
        const aucID = t.id.padEnd(6)
        const aucPrice = numFmt(t.price).padEnd(9)
        const timesOver = t.price_over.toLocaleString('en-us', {maximumFractionDigits: 1}).padEnd(6)
        const eval = numFmt(t.eval).padEnd(7)
        let col
        if (!isNaN(t.card[0]))
            col = byAlias(ctx, ctx.cards[t.card[0]].col)[0]

        pages[Math.floor(i/10)] += `\`${auditID} | ${aucID} | ${aucPrice} | ${eval} | ${timesOver} | ${col? col.promo : 'false'}\`\n`
    })

    return pages
}

const paginateRebuys = async (ctx, user, list) => {
    let pages = []

    list.map((t, i) => {
        if (i % 10 == 0) pages.push("`Audit ID | Auc ID | Auc Price | Trans Id | Trans Cost | Promo?`\n")
        let col

        if (!isNaN(t.card[0]))
            col = byAlias(ctx, ctx.cards[t.card[0]].col)[0]

        const auditID = t.audit_id.padEnd(8)
        const aucID = t.id.padEnd(6)
        const aucPrice = numFmt(t.price).padEnd(9)
        const transID = t.transid.padEnd(8)
        const transCost = numFmt(t.transprice).padEnd(10)

        pages[Math.floor(i/10)] += `\`${auditID} | ${aucID} | ${aucPrice} | ${transID} | ${transCost} | ${col? col.promo : 'false'}\`\n`
    })

    return pages
}



const paginateGuildTrsList = (ctx, user, list) => {
    const pages = []
    list.map((t, i) => {
        if (i % 10 == 0) pages.push("")
        pages[Math.floor(i/10)] += `${formatGuildTrsList(ctx, user, t)}\n`
    })
    return pages;
}

const paginateCompletedAuditList = (ctx, user, list) => {
    const pages =[]
    list.map((t, i) => {
        if (i % 10 == 0) pages.push("")
        pages[Math.floor(i/10)] += `${formatCompletedList(ctx, user, t)}\n`
    })
    return pages;
}






const formatGuildTrsList = (ctx, user, gtrans) => {
    let resp = ""
    const timediff = msToTime(new Date() - gtrans.time, {compact: true})

    resp += `[${timediff}] ${ch_map[gtrans.status]} \`${gtrans.id}\` ${gtrans.cards.length} card(s) **${gtrans.from}** \`->\` **${gtrans.to}**`
    return resp;
}

const formatAucBidList = (ctx, user, bids) => {
    let resp = ""
    resp += `${numFmt(bids.bid)}${ctx.symbols.tomato}, \`${bids.user}\`, ${dateFormat(bids.time, "yyyy-mm-dd HH:MM:ss")}`
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

const createFindUserEmbed = (ctx, user, findUser) => {
    let effects = findUser.effects.map(x => x.id)

    const dailyStats = `
    Claims: (Current: **${findUser.dailystats.claims}**, Total: **${findUser.dailystats.totalregclaims}**, Promo: **${findUser.dailystats.promoclaims}**) 
    Bids: **${findUser.dailystats.bids}**, Auctions: **${findUser.dailystats.aucs}**, Tags: **${findUser.dailystats.tags}**
    Liq: **${findUser.dailystats.liquify}**, Liq1: **${findUser.dailystats.liquify1}**, Liq2: **${findUser.dailystats.liquify2}**, Liq3: **${findUser.dailystats.liquify3}**
    Draw: **${findUser.dailystats.draw}**, Draw1: **${findUser.dailystats.draw1}**, Draw2: **${findUser.dailystats.draw2}**, Draw3: **${findUser.dailystats.draw3}**
    Forge1: **${findUser.dailystats.forge1}**, Forge2: **${findUser.dailystats.forge2}**, Forge3: **${findUser.dailystats.forge3}**`

    let findEmbed = {
        author: {name: `${user.username} here is the info for ${findUser.username}`},
        description: `**${findUser.username}** \`${findUser.discord_id}\`
                      Currency: **${numFmt(findUser.exp)}${ctx.symbols.tomato}**, **${numFmt(findUser.vials)}${ctx.symbols.vial}**, **${numFmt(findUser.lemons)}${ctx.symbols.lemon}**
                      Promo Currency: **${numFmt(findUser.promoexp)}**
                      Embargoed?: **${findUser.ban.embargo? 'true': 'false'}**
                      Join Date: **${dateFormat(findUser.joined, "yyyy-mm-dd HH:MM:ss")}**
                      Last Daily: **${dateFormat(findUser.lastdaily, "yyyy-mm-dd HH:MM:ss")}**
                      Unique Cards: **${numFmt(findUser.cards.length)}**
                      Completed Collections: **${findUser.completedcols? findUser.completedcols.length: 0}**
                      Effects List: **${effects.length !== 0? effects: 'none'}**
                      __Daily Stats__: 
                      ${dailyStats}`,
        color: colors['green']
    }

    return findEmbed
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
    clean_audits,
    createFindUserEmbed,
    eval_fraud_check,
    formatAucBidList,
    formatGuildTrsList,
    paginateBotSells,
    paginateCompletedAuditList,
    paginateGuildTrsList,
    paginateOverPrice,
    paginateOversells,
    paginateRebuys,
    parseAuditArgs,
    trans_fraud_check,
}
