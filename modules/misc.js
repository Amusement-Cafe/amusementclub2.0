const {cmd} = require('../utils/cmd')

cmd('help', async (ctx, user, ...args) => {
    //console.log('a user', user.username, 'sent help with args', args, 'in channel:', msg.channel.id)
    const ch = await ctx.bot.getDMChannel(user.discord_id)
    ctx.send(ch.id, { description: "help" })
    ctx.reply(user, 'help was sent to you')
})
