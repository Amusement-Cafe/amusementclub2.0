var queue = []
var bot;

const colors = require('./colors')

const addConfirmation = async (ctx, user, question, permits, confirm, decline) => {
    queue = queue.filter(x => x.userID != user.discord_id)
    //permits.push(user.discord_id)

    const obj = {
        userID: user.discord_id,
        permits: permits,
        expires: new Date(),
        onConfirm: confirm,
        onDecline: decline
    }

    obj.expires.setMinutes(obj.expires.getMinutes() + 1)
    queue.push(obj)

    const msg = await ctx.send(ctx.msg.channel.id, getEmbed(user, question))

    obj.msg = msg.id
    obj.channel = msg.channel.id

    await ctx.bot.addMessageReaction(msg.channel.id, msg.id, '✅')
    await ctx.bot.addMessageReaction(msg.channel.id, msg.id, '❌')
}

const getEmbed = (user, text) => {
    return { 
        title: `Confirmation`, 
        description: `**${user.username},** ${text}` ,
        //footer: { text: `Page ${pg.page + 1}/${pg.data.length}` },
        color: colors.yellow
    }
}

const tick = () => {
    const now = new Date()
    queue.map(async x => {
        if(bot && x.expires < now) {
            await bot.removeMessageReactions(x.channel, x.msg)
            await bot.editMessage(x.channel, x.msg, { embed: {
                description: 'This confirmation dialog has expired',
                color: colors.red
            }})
        }
    })

    queue = queue.filter(x => x.expires > now)
}

module.exports = {
    addConfirmation
}

const {rct} = require('../utils/cmd')

setInterval(tick.bind(this), 5000);

rct('✅', '❌', async (ctx) => {
    const msg = ctx.msg
    const data = queue.filter(x => x.msg === msg.id && x.permits.filter(y => y === ctx.userID)[0])[0]

    if(data) {
        queue = queue.filter(x => x.msg != msg.id)

        if(ctx.emoji.name === '✅' && data.onConfirm)
            data.onConfirm()
        else if(ctx.emoji.name === '❌' && data.onDecline)
            data.onDecline()

        await ctx.bot.deleteMessage(msg.channel.id, msg.id, 'Removing confirmation dialog')
    }
})