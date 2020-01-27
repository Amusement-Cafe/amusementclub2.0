const Eris      = require('eris')
const mongoose  = require('mongoose')
const colors    = require('./utils/colors')
const {trigger} = require('./utils/cmd')
const commands  = require('./commands')
const Emitter   = require('events')
const asdate    = require('add-subtract-date')
const _         = require('lodash')

const {
    check_achievements
} = require('./modules/achievement')

const {
    auction, 
    user,
    guild
} = require('./modules')

var userq = require('./utils/userq')

module.exports.start = async ({ shard, database, token, prefix, baseurl, shorturl, data }) => {
    console.log('[info] intializing connection and starting bot...')

    /* prefill in the urls */
    data.cards = data.cards.map((x, i) => {
        const col = data.collections.filter(y => y.id == x.col)[0]
        const basePath = `/cards/${col.id}/${x.level}_${x.name}.${x.animated? 'gif' : (col.compressed? 'jpg' : 'png')}`
        x.url = baseurl + basePath
        x.shorturl = shorturl + basePath
        x.id = i
        return x
    })

    const mongoUri = database
    const mongoOpt = {useNewUrlParser: true, useUnifiedTopology: true}

    /* basics */
    const mcn = await mongoose.connect(mongoUri, mongoOpt)
    const bot = new Eris(token)

    /* create our glorious sending fn */
    const send = (ch, content, userid) => { 
        if(content.description)
            content.description = content.description.replace(/  /gi, '')

        if(content.fields)
            content.fields.map(x => x.value = x.value.replace(/  /gi, ''))

        if(userid)
            _.remove(userq, (x) => x.id === userid)

        return bot.createMessage(ch, { embed: content })
    }

    const toObj = (user, str, clr) => {
        if(typeof str === 'object') {
            str.description = `**${user.username}**, ${str.description}`
            return str
        }

        return { description: `**${user.username}**, ${str}`, color: colors[clr] }
    }

    /* create direct reply fn */
    const direct = async (user, str, clr = 'default') => {
        const ch = await bot.getDMChannel(user.discord_id)
        return send(ch.id, toObj(user, str, clr), user.discord_id)
    }

    const symbols = {
        tomato: '`🍅`',
        vial: '`🍷`',
        star: '★'
    }

    /* create our context */
    const ctx = {
        mcn, /* mongoose database connection */
        bot, /* created and connected Eris bot instance */
        send, /* a sending function to send stuff to a specific channel */
        cards: data.cards, /* data with cards */
        collections: data.collections, /* data with collections */
        help: data.help, /* help data */
        items: data.items, /* game items */
        achievements: data.achievements, /* game achievements */
        direct, /* DM reply function to the user */
        shard, /* current shard */
        symbols,
        baseurl
    }

    /* service tick for checks */
    const tick = (ctx) => {
        const now = new Date()
        auction.finish_aucs(ctx, now)
        guild.bill_guilds(ctx, now)
    }

    if(shard === 0)
        setInterval(tick.bind({}, ctx), 5000);

    /* events */
    bot.on('ready', async event => {
        //bot.setPresence({ game: { name: '->help' } })

        console.log('[info] bot is ready')
        console.log(bot.guilds.map(x => x.name))
    })

    bot.on('messageCreate', async (msg) => {
        if (!msg.content.startsWith(prefix)) return; /* skip not commands */
        if (msg.author.bot || userq.filter(x => x.id === msg.author.id)[0]) return; /* skip bot or cooldown users */
        msg.content = msg.content.toLowerCase()

        try {

            /* create our player reply sending fn */
            const reply = (user, str, clr = 'default') => send(msg.channel.id, toObj(user, str, clr), user.discord_id)

            /* fill in additional context data */
            const isolatedCtx = Object.assign({}, ctx, {
                msg, /* current icoming msg object */
                reply, /* quick reply function to the channel */
            })

            /* add user to cooldown q */
            userq.push({id: msg.author.id, expires: asdate.add(new Date(), 2, 'seconds')});

            const usr = await user.fetchOrCreate(isolatedCtx, msg.author.id, msg.author.username)
            isolatedCtx.guild = await guild.fetchOrCreate(isolatedCtx, usr, msg.channel.guild)
            isolatedCtx.discord_guild = msg.channel.guild
            const args = msg.content.trim().substring(prefix.length).split(/ +/)
            const action = args[0]

            if(usr.lock) {
                usr.lock = false
                await usr.save()
            }

            await trigger('cmd', isolatedCtx, usr, args, prefix)
            await check_achievements(isolatedCtx, usr, action)
            
        } catch (e) {
            send(msg.channel.id, { description: e.message, color: colors.red })
            console.error(e)
        }
    })

    bot.on('messageReactionAdd', async (msg, emoji, userID) => {
        if (!msg.author || msg.author.id != bot.user.id || userID == bot.user.id)
            return

        try {
            const isolatedCtx = Object.assign({}, ctx, {
                msg, /* current icoming message */
                emoji, /* reaction data */
                cards: data.cards, /* data with cards */
                collections: data.collections, /* data with collections */
            })

            const usr  = await user.fetchOnly(userID)
            isolatedCtx.guild = msg.channel.guild

            if(!usr) return

            await trigger('rct', isolatedCtx, usr, [emoji.name])
        } catch (e) {
            //send(msg.channel.id, { description: e.message, color: colors.red })
            console.error(e)
        }
    })

    bot.connect();

    return new Emitter()
}
