var pages = []
var bot;

const colors = require('./colors')
const asdate = require('add-subtract-date')

const addPagination = async (ctx, user, title, data) => {
    pages = pages.filter(x => x.userID != user.discord_id)

    const obj = {
        title: title,
        page: 0,
        username: user.username,
        userID: user.discord_id,
        data: data,
        expires: asdate.add(new Date(), 10, 'minutes'),
    }

    pages.push(obj)
    const msg = await ctx.send(ctx.msg.channel.id, getEmbed(obj))

    obj.msg = msg.id
    obj.channel = msg.channel.id

    if(data.length > 1) {
        await ctx.bot.addMessageReaction(msg.channel.id, msg.id, '⏪')
        await ctx.bot.addMessageReaction(msg.channel.id, msg.id, '⬅')
        await ctx.bot.addMessageReaction(msg.channel.id, msg.id, '➡')
        await ctx.bot.addMessageReaction(msg.channel.id, msg.id, '⏩')
    }

    bot = ctx.bot
}

const tick = () => {
    const now = new Date()
    pages.map(x => {
        if(bot && x.expires < now)
            bot.removeMessageReactions(x.channel, x.msg)
    })

    pages = pages.filter(x => x.expires > now)
}

const edit = (ctx, page) => ctx.bot.editMessage(ctx.msg.channel.id, ctx.msg.id, { embed: getEmbed(page) })

const getEmbed = (pg) => {
    return { 
        title: `${pg.username}, ${pg.title}`, 
        description: pg.data[pg.page] ,
        footer: { text: `Page ${pg.page + 1}/${pg.data.length}` },
        color: colors.blue
    }
}

module.exports = {
    addPagination
}

const {rct} = require('../utils/cmd')

setInterval(tick.bind(this), 5000);

rct('➡', '⬅', '⏩', '⏪', async (ctx, user) => {
    const msg = ctx.msg
    const name = ctx.emoji.name
    const pg = pages.filter(x => x.msg === msg.id && x.userID === user.discord_id)[0]

    if(!pg) return;

    if((name === '➡' || name === '⏩') && pg.page < pg.data.length - 1) {

        pg.page = name === '➡'? pg.page + 1 : pg.data.length - 1
        await edit(ctx, pg)

    } else if((name === '⬅' || name === '⏪') && pg.page > 0) {

        pg.page = name === '⬅'? pg.page - 1 : 0
        await edit(ctx, pg)

    }

    return await ctx.bot.removeMessageReaction(msg.channel.id, msg.id, name, user.discord_id)
})