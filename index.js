const Eris      = require('eris')
const mongoose  = require('mongoose')
const colors    = require('./utils/colors')
const {trigger} = require('./utils/cmd')
const commands  = require('./commands')
const Emitter   = require('events')
const asdate    = require('add-subtract-date')
const _         = require('lodash')

const {
    auction, 
    user,
    guild
} = require('./modules')

var userq       = require('./userq.js')

module.exports.start = async ({ shard, database, token, prefix, baseurl, shorturl, data }) => {
    console.log('[info] intializing connection and starting bot...')

    /* prefill in the urls */
    data.cards = data.cards.map((x, i) => {
        const basePath = `/cards/${data.collections.filter(y => y.id == x.col)[0].id}/${x.level}_${x.name}.${x.animated? 'gif' : 'jpg'}`
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
            content.description = content.description.replace(/{currency}/gi, '`🍅`')

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

    /* create our context */
    const ctx = {
        mcn, /* mongoose database connection */
        bot, /* created and connected Eris bot instance */
        send, /* a sending function to send stuff to a specific channel */
        cards: data.cards, /* data with cards */
        collections: data.collections, /* data with collections */
        help: data.help, /* help data */
        direct, /* DM reply function to the user */
        shard, /* current shard */
    }

    /* service tick for checks */
    const tick = (ctx) => {
        const now = new Date()
        auction.finish_aucs(ctx, now)
    }

    if(shard === 0)
        setInterval(tick.bind({}, ctx), 2500);

    /* events */
    bot.on('ready', async event => {
        //bot.setPresence({ game: { name: '->help' } })

        console.log('[info] bot is ready')
    })

    bot.on('messageCreate', async (msg) => {
        if (!msg.content.startsWith(prefix)) return; /* skip not commands */
        if (msg.author.bot || userq.filter(x => x.id === msg.author.id)[0]) return; /* skip bot or cooldown users */

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

            const usr  = await user.fetchOrCreate(isolatedCtx, msg.author.id, msg.author.username)
            const gld = await guild.fetchOrCreate(isolatedCtx, usr, msg.channel.guild)
            const args = msg.content.trim().substring(prefix.length).split(' ')

            if(gld)
                isolatedCtx.guild = Object.assign({}, gld, msg.channel.guild)

            await trigger('cmd', isolatedCtx, usr, args, prefix)
        } catch (e) {
            const color = e.message.indexOf('Unknown command name') !== -1
                ? colors.yellow /* nice 404 color */
                : colors.red /* nice pure error color */

            send(msg.channel.id, { description: e.message, color })
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

            if(!usr) return

            await trigger('rct', isolatedCtx, usr, [emoji.name])
        } catch (e) {
            send(msg.channel.id, { description: e.message, color: colors.red })
        }
    })

    bot.connect();

    return new Emitter()
}
