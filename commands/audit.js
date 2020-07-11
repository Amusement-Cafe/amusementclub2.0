const {pcmd}                    = require('../utils/cmd')
const {Audit, AuditAucSell}     = require('../collections')
const colors                    = require('../utils/colors')

const {
    paginate_auditReports,
    auditAuc,
    auditGuild,
    auditUser,
    auditTrans,
    auditWarn
}   = require("../modules/audit");




pcmd(['admin', 'auditor'], ['fraud', 'report'], async (ctx, user, ...args) => {
    if (ctx.msg.channel.id != ctx.audit['channel'])
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    let switchType = args.shift()

    switch(switchType) {
        case '1':
            let overSell = await AuditAucSell.find({sold: {$gt:5}}).sort({sold: -1})

            return  ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
                pages: paginate_auditReports(ctx, user, overSell, 1),
                buttons: ['back', 'forward'],
                embed: {
                    author: { name: `${user.username}, open report 2 audits: (${overSell.length} results)` },
                    color: colors.blue,
                }
            })

        case '2':

            let overPrice = (await Audit.find({ audited: false, report_type: 2 }).sort({price_over : -1}))

            return  ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
                pages: paginate_auditReports(ctx, user, overPrice, 2),
                buttons: ['back', 'forward'],
                embed: {
                    author: { name: `${user.username}, open report 2 audits: (${overPrice.length} results)` },
                    color: colors.blue,
                }
            })

        case '3':
            let buybacks = await Audit.find({audited: false, report_type: 3}).sort({price: -1})

            return  ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
                pages: paginate_auditReports(ctx, user, buybacks, 3),
                buttons: ['back', 'forward'],
                embed: {
                    author: { name: `${user.username}, open report 3 audits: (${buybacks.length} results)` },
                    color: colors.blue,
                }
            })

        default:
            return ctx.reply(user, `**__Choose a fraud report__**
                                    Fraud Report 1: Lists users who have more auction sales than returns
                                    Fraud Report 2: Lists overpriced auctions
                                    Fraud Report 3: Lists users who sold a card on auction and then bought the card back`)

    }

})

pcmd(['admin', 'auditor'], ['audit'], async (ctx, user, ...args) => {
    if (ctx.msg.channel.id != ctx.audit['channel'])
        return ctx.reply(user, 'This command can only be run in an audit channel.', 'red')

    if(!args)
        return ctx.reply(user, 'Please add an argument', 'red')
    let caseArg = args.shift()

    switch(caseArg){
        case 'user':
            await auditUser(ctx, user, args)
            break
        case 'guild':
            await auditGuild(ctx, user, args)
            break
        case 'auc':
        case 'auction':
            await auditAuc(ctx, user, args)
            break
        case 'trans':
            await auditTrans(ctx, user, args)
            break
        case 'warn':
            await auditWarn(ctx, user, args)
            break
    }

})

