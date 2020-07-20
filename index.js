const Eris          = require('eris')
const mongoose      = require('mongoose')
const colors        = require('./utils/colors')
const commands      = require('./commands')
const Emitter       = require('events')
const asdate        = require('add-subtract-date')
const paginator     = require('discord-paginator')
const _             = require('lodash')
const {trigger}     = require('./utils/cmd')
const {check_all}   = require('./modules/secondarycheck')
const Filter        = require('bad-words')

const {
    auction,
    audit,
    user,
    guild,
    hero
} = require('./modules')

var userq = require('./utils/userq')

module.exports.schemas = require('./collections')
module.exports.modules = require('./modules')

module.exports.create = async ({ 
        shards, database, token, prefix, 
        baseurl, shorturl, auditc, debug, 
        maintenance, data 
    }) => {

    const emitter = new Emitter()

    const fillCardData = (carddata) => {
        data.cards = carddata.map((x, i) => {
            const col = data.collections.filter(y => y.id == x.col)[0]
            const ext = x.animated? 'gif' : (col.compressed? 'jpg' : 'png')
            const basePath = `/${col.promo? 'promo':'cards'}/${col.id}/${x.level}_${x.name}.${ext}`
            x.url = baseurl + basePath
            x.shorturl = shorturl + basePath
            x.id = i
            return x
        })
    }

    /* prefill in the urls */
    fillCardData(data.cards)

    const mongoUri = database
    const mongoOpt = {useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false}

    /* basics */
    const mcn = await mongoose.connect(mongoUri, mongoOpt)
    const bot = new Eris(token, { maxShards: shards })

    /* create our glorious sending fn */
    const send = (ch, content, userid) => { 
        if(content.description)
            content.description = content.description.replace(/\s\s+/gi, '\n')

        if(content.fields)
            content.fields.map(x => x.value = x.value.replace(/\s\s+/gi, '\n'))

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

    const qhelp = (ctx, user, cat) => {
        const help = ctx.help.filter(x => x.type.includes(cat))[0]
        return send(ctx.msg.channel.id, {
            author: { name: `Possible options:` },
            fields: help.fields.slice(0, 5).map(x => ({ name: x.title, value: x.description })),
            color: colors.blue,
            footer: { text: `For full information type ->help ${cat} -here` }
        }, user.discord_id)
    }

    const symbols = {
        tomato: '`🍅`',
        vial: '`🍷`',
        star: '★',
        auc_sbd: '🔹',
        auc_lbd: '🔷',
        auc_sod: '🔸',
        auc_wss: '▫️',
        accept: '✅',
        decline: '❌',
        red_circle: '`🔴`'
    }

    const pgn = paginator.create({ bot, pgnButtons: ['first', 'last', 'back', 'forward'] })
    const filter = new Filter()
    filter.addWords(...data.bannedwords)

    /* create our context */
    const ctx = {
        mcn, /* mongoose database connection */
        bot, /* created and connected Eris bot instance */
        send, /* a sending function to send stuff to a specific channel */
        cards: data.cards, /* data with cards */
        collections: data.collections, /* data with collections */
        help: require('./staticdata/help'),
        items: require('./staticdata/items'),
        achievements: require('./staticdata/achievements'),
        quests: require('./staticdata/quests'),
        effects: require('./staticdata/effects'),
        promos: data.promos,
        boosts: data.boosts,
        filter,
        direct, /* DM reply function to the user */
        symbols,
        baseurl,
        pgn,
        qhelp,
        audit: auditc,
        cafe: 'https://discord.gg/xQAxThF', /* support server invite */
        settings: {
            wip: maintenance,
        }
    }

    const globalArgsMap = {
        f: 'force',
    }

    /* service tick for checks */
    const tick = (ctx) => {
        const now = new Date()
        auction.finish_aucs(ctx, now)
        guild.bill_guilds(ctx, now)
        audit.clean_audits(ctx, now)
    }

    /* service tick for user checks */
    const qtick = () => {
        const now = new Date()
        _.remove(userq, (x) => x.expires < now)
    }

    /* service tick for hero checks */
    const htick = (ctx) => {
        const now = new Date()
        hero.check_heroes(ctx, now)
    }

    setInterval(tick.bind({}, ctx), 5000)
    setInterval(qtick.bind({}, ctx), 1000)
    //setInterval(htick.bind({}, ctx), 60000 * 2)
    setInterval(htick.bind({}, ctx), 6000)

    /* events */
    mongoose.connection.on('error', err => {
        emitter.emit('error', err)
    })

    bot.on('ready', async event => {
        await bot.editStatus('online', { name: 'commands', type: 2})
        emitter.emit('info', `Bot is ready on **${bot.guilds.size} guild(s)** with **${bot.users.size} user(s)** using **${bot.shards.size} shard(s)**`)
    })

    bot.on('messageCreate', async (msg) => {
        if (msg.author.bot || userq.filter(x => x.id === msg.author.id)[0]) return; /* skip bot or cooldown users */

        let curprefix = prefix
        const curguild = await guild.fetchOnly(msg.channel.guild)
        if(curguild) {
            curprefix = curguild.prefix
        }

        if (!msg.content.startsWith(curprefix)) return;
        msg.content = msg.content.toLowerCase()

        try {
            /* create our player reply sending fn */
            const reply = (user, str, clr = 'default') => send(msg.channel.id, toObj(user, str, clr), user.discord_id)

            /* fill in additional context data */
            const isolatedCtx = Object.assign({}, ctx, {
                msg, /* current icoming msg object */
                reply, /* quick reply function to the channel */
                globals: {}, /* global parameters */
                discord_guild: msg.channel.guild,  /* current discord guild */
            })

            /* add user to cooldown q */
            userq.push({id: msg.author.id, expires: asdate.add(new Date(), 2, 'seconds')});

            let args = msg.content.trim().substring(curprefix.length).split(/ +/)
            let usr = await user.fetchOrCreate(isolatedCtx, msg.author.id, msg.author.username)
            const action = args[0]

            if(ctx.settings.wip && !usr.roles.includes('admin') && !usr.roles.includes('mod')) {
                return reply(usr, 'bot is currently under maintenance. Please check again later |ω･)ﾉ', 'yellow')
            }

            isolatedCtx.guild = curguild || await guild.fetchOrCreate(isolatedCtx, usr, msg.channel.guild)
            args.filter(x => x.length === 2 && x[0] === '-').map(x => {
                isolatedCtx.globals[globalArgsMap[x[1]]] = true
            })
            args = args.filter(x => !(x.length === 2 && x[0] === '-' && globalArgsMap.hasOwnProperty(x[1])))
            usr.exp = Math.min(usr.exp, 10**7)
            usr.vials = Math.min(usr.vials, 10**6)

            await trigger('cmd', isolatedCtx, usr, args, prefix)
            //usr = await user.fetchOnly(msg.author.id)
            usr.unmarkModified('dailystats')
            await check_all(isolatedCtx, usr, action)
            
        } catch (e) {
            if(debug)
                await send(msg.channel.id, { description: e.message, color: colors.red })
            emitter.emit('error', e)
        }
    })

    bot.on('messageReactionAdd', async (msg, emoji, userID) => {
        if (!msg.author || msg.author.id != bot.user.id || userID == bot.user.id)
            return

        try {
            /*const isolatedCtx = Object.assign({}, ctx, {
                msg, 
                emoji,
            })*/

            //const usr  = await user.fetchOnly(userID)
            //if(!usr) return

            await pgn.trigger(userID, msg, emoji.name)
        } catch (e) {
            emitter.emit('error', e)
        }
    })

    bot.on('error', async (err, sh) => {
        emitter.emit('error', err, sh)
    })

    pgn.emitter.on('resolve', async (res, obj) => {
        if(!res || !obj.channel || !obj.onConfirm) return;

        const isolatedCtx = Object.assign({}, ctx)

        const usr = await user.fetchOnly(obj.userID)
        await check_all(isolatedCtx, usr, obj.action, obj.channel)
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
