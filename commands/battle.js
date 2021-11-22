const msToTime  = require('pretty-ms')
const { battle } = require('../modules')
const { fetchOrCreateBP } = require('../modules/battle')
const { format_gain } = require('../modules/expedition')
const { cmd } = require('../utils/cmd')

cmd(['gems'], async (ctx, user, ...args) => {
    const battleProfile = await fetchOrCreateBP(ctx, user)
    return ctx.reply(user, `you have ${format_gain(ctx, battleProfile.inv)}`, 'amethyst')
}).access('dm')

cmd(['card', 'upgrade'], ['cd', 'up'], async (ctx, user, ...args) => {
    
}).access('dm')
