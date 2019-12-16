const {cmd}                 = require('../utils/cmd')
const {
    confirm_trs,
    decline_trs,
    check_trs
} = require('../modules/transaction')

cmd('confirm', 'cfm', async (ctx, user, arg1) => {
	confirm_trs(ctx, user, arg1)
})

cmd('decline', 'dcl', async (ctx, user, arg1) => {
	decline_trs(ctx, user, arg1)
})
