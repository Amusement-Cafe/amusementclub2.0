var pages = []
var bot;

const colors = require('./colors')

const addPagination = async (ctx, user, title, data) => {
    pages = pages.filter(x => x.userID != user.discord_id)

    const obj = {
        title: title,
        page: 0,
        username: user.username,
        userID: user.discord_id,
        data: data,
        expires: new Date()
    }

    obj.expires.setMinutes(obj.expires.getMinutes() + 10)

    pages.push(obj)
    const msg = await ctx.send(ctx.msg.channel.id, getEmbed(obj))

    obj.msg = msg.id
    obj.channel = msg.channel.id

    await ctx.bot.addMessageReaction(msg.channel.id, msg.id, '⏪')
    await ctx.bot.addMessageReaction(msg.channel.id, msg.id, '⬅')
    await ctx.bot.addMessageReaction(msg.channel.id, msg.id, '➡')
    await ctx.bot.addMessageReaction(msg.channel.id, msg.id, '⏩')

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

rct('➡', async (ctx) => {
    const msg = ctx.msg
    const pg = pages.filter(x => x.msg === msg.id && x.userID === ctx.userID)[0]

    if(pg && pg.page < pg.data.length - 1) {
        pg.page++
        await edit(ctx, pg)
    }

    await ctx.bot.removeMessageReaction(msg.channel.id, msg.id, '➡', ctx.userID)
})

rct('⬅', async (ctx) => {
    const msg = ctx.msg
    const pg = pages.filter(x => x.msg === msg.id && x.userID === ctx.userID)[0]

    if(pg && pg.page > 0) {
        pg.page--
        await edit(ctx, pg)
    }

    await ctx.bot.removeMessageReaction(msg.channel.id, msg.id, '⬅', ctx.userID)
})

rct('⏩', async (ctx) => {
    const msg = ctx.msg
    const pg = pages.filter(x => x.msg === msg.id && x.userID === ctx.userID)[0]

    if(pg && pg.page < pg.data.length - 1) {
        pg.page = pg.data.length - 1
        await edit(ctx, pg)
    }

    await ctx.bot.removeMessageReaction(msg.channel.id, msg.id, '⏩', ctx.userID)
})

rct('⏪', async (ctx) => {
    const msg = ctx.msg
    const pg = pages.filter(x => x.msg === msg.id && x.userID === ctx.userID)[0]

    if(pg && pg.page > 0) {
        pg.page = 0
        await edit(ctx, pg)
    }

    await ctx.bot.removeMessageReaction(msg.channel.id, msg.id, '⏪', ctx.userID)
})
