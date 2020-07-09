const {paginate_overPrice, paginate_rebuys}  = require("../modules/audit");
const {pcmd}                = require('../utils/cmd')
const {Audit}               = require('../collections')
const colors                = require('../utils/colors')





pcmd(['admin', 'mod', 'auditor'], ['fraud', 'report'], async (ctx, user, args) => {
    switch(args) {
        case '2':

            let overPrice = (await Audit.find({ audited: false, report_type: 2 }).sort({price_over : -1}))

            return  ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
                pages: paginate_overPrice(ctx, user, overPrice),
                buttons: ['back', 'forward'],
                embed: {
                    author: { name: `${user.username}, open report 2 audits: (${overPrice.length} results)` },
                    color: colors.blue,
                }
            })
        break;
        case '3':
            let buybacks = await Audit.find({audited: false, report_type: 3}).sort({price: -1})

            return  ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
                pages: paginate_rebuys(ctx, user, buybacks),
                buttons: ['back', 'forward'],
                embed: {
                    author: { name: `${user.username}, open report 3 audits: (${buybacks.length} results)` },
                    color: colors.blue,
                }
            })
            break;
    }

})
