const Eris          = require('eris')
const mongoose      = require('mongoose')
const colors        = require('./utils/colors')
const commands      = require('./commands')
const Emitter       = require('events')
const asdate        = require('add-subtract-date')
const paginator     = require('discord-paginator')
const _             = require('lodash')

const {
    trigger, 
    rct
} = require('./utils/cmd')

const {
    check_achievements
} = require('./modules/achievement')

const {
    auction, 
    user,
    guild
} = require('./modules')

var userq = require('./utils/userq')

module.exports.create = async ({ shards, database, token, prefix, baseurl, shorturl, data }) => {
    const emitter = new Emitter()

    const fillCardData = (carddata) => {
        data.cards = carddata.map((x, i) => {
            const col = data.collections.filter(y => y.id == x.col)[0]
            const basePath = `/cards/${col.id}/${x.level}_${x.name}.${x.animated? 'gif' : (col.compressed? 'jpg' : 'png')}`
            x.url = baseurl + basePath
            x.shorturl = shorturl + basePath
            x.id = i
            return x
        })
    }

    /* prefill in the urls */
    fillCardData(data.cards)

    const mongoUri = database
    const mongoOpt = {useNewUrlParser: true, useUnifiedTopology: true}

    /* basics */
    const mcn = await mongoose.connect(mongoUri, mongoOpt)
    const bot = new Eris(token, { maxShards: shards })

    /* create our glorious sending fn */
    const send = (ch, content, userid) => { 
        /*if(content.description)
            content.description = content.description.replace(/\s\s+/gi, '')

        if(content.fields)
            content.fields.map(x => x.value = x.value.replace(/\s\s+/gi, ''))*/

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
        star: '★',
        auc_sbd: '🔹',
        auc_lbd: '🔷',
        auc_sod: '🔸',
        auc_wss: '▫️'
    }

    const pgn = paginator.create({ bot, pgnButtons: ['first', 'last', 'back', 'forward'] })

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
        symbols,
        baseurl,
        pgn,
        cafe: 'https://discord.gg/xQAxThF', /* support server invite */
    }

    /* service tick for checks */
    const tick = (ctx) => {
        const now = new Date()
        auction.finish_aucs(ctx, now)
        guild.bill_guilds(ctx, now)
    }

    /* service tick for user checks */
    const qtick = () => {
        const now = new Date()
        _.remove(userq, (x) => x.expires < now)
    }

    setInterval(tick.bind({}, ctx), 5000)
    setInterval(qtick.bind({}, ctx), 1000)

    /* events */
    bot.on('ready', async event => {
        await bot.editStatus('online', { name: 'commands', type: 2})
        emitter.emit('info', `Bot is ready on ${bot.guilds.size} guild(s) with ${bot.users.size} user(s) using ${bot.shards.size} shard(s)`)
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
            //if(debug)
            await send(msg.channel.id, { description: e.message, color: colors.red })
            emitter.emit('error', e)
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

            await pgn.trigger(userID, msg, emoji.name)

            await trigger('rct', isolatedCtx, usr, [emoji.name])
        } catch (e) {
            let sh = msg.channel.guild.shard
            emitter.emit('error', e, sh.id)
        }
    })

    bot.on('error', async (err, sh) => {
        emitter.emit('error', err, sh)
    })

    return {
        emitter,
        connect: () => bot.connect(),
        disconnect: () => bot.disconnect(),
        reconnect: () => bot.disconnect({ reconnect: 'auto' }),
        updateCards: (carddata) => fillCardData(carddata),
        updateCols: (coldata) => data.collections = coldata,
    }
}
