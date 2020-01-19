var queue = []
var bot;

const colors = require('./colors')
const asdate = require('add-subtract-date')

const addConfirmation = async (ctx, user, question, permits, confirm, decline, footer) => {
    bot = ctx.bot
    const old = queue.filter(x => x.userID === user.discord_id)[0]

    if(old)
        await bot.removeMessageReactions(old.channel, old.msg)

    queue = queue.filter(x => x.userID != user.discord_id)
    permits = permits || { confirm: [user.discord_id], decline: [user.discord_id] }

    const obj = {
        userID: user.discord_id,
        permits: permits,
        expires: asdate.add(new Date(), 1, 'minutes'),
        onConfirm: confirm,
        onDecline: decline
    }

    queue.push(obj)

    user.lock = true
    await user.save()
    const msg = await ctx.send(ctx.msg.channel.id, getEmbed(user, question, footer), user.discord_id)

    obj.msg = msg.id
    obj.channel = msg.channel.id

    await ctx.bot.addMessageReaction(msg.channel.id, msg.id, '✅')
    await ctx.bot.addMessageReaction(msg.channel.id, msg.id, '❌')
}

const getEmbed = (user, text, footer) => {
    return { 
        title: `Confirmation`, 
        description: text,
        footer: { text: footer },
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

rct('✅', '❌', async (ctx, user) => {
    const msg = ctx.msg
    const data = queue.filter(x => x.msg === msg.id)[0]

    if(data && ctx.emoji.name === '✅' && data.onConfirm 
        && data.permits.confirm.filter(y => y === user.discord_id)[0]) {
        if(user.lock){
            data.onConfirm(user)
        } else {
            ctx.send(ctx.msg.channel.id, { 
                description: `A command was ran before confirmation. This is not allowed`,
                color: colors.red
            })
        }

    } else if(data && ctx.emoji.name === '❌' && data.onDecline
        && data.permits.decline.filter(y => y === user.discord_id)[0]) {
        data.onDecline(user)

    } else return

    queue = queue.filter(x => x.msg != msg.id)
    await ctx.bot.deleteMessage(msg.channel.id, msg.id, 'Removing confirmation dialog')
})