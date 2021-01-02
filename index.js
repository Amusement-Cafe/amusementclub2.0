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
const {connectDBL}  = require('./modules/dbl')
const Filter        = require('bad-words')

const Mixpanel = require('mixpanel');

const {
    auction,
    audit,
    user,
    guild,
    hero
} = require('./modules')

var userq = []
var guildq = []

module.exports.schemas = require('./collections')
module.exports.modules = require('./modules')

module.exports.create = async ({ 
        shards, database, token, prefix, 
        baseurl, shorturl, auditc, debug, 
        maintenance, invite, data, dbl, analytics
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

            if(x.added)
                x.added = Date.parse(x.added)

            return x
        })
    }

    /* prefill in the urls */
    fillCardData(data.cards)

    const mongoUri = database
    const mongoOpt = {useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, useCreateIndex: true}

    /* basics */
    const mcn = await mongoose.connect(mongoUri, mongoOpt)
    const bot = new Eris(token, { maxShards: shards })

    /* create our glorious sending fn */
    const send = (ch, content, userid) => { 
        if(content.description)
            content.description = content.description.replace(/\s\s+/gm, '\n')

        if(content.fields)
            content.fields.map(x => x.value = x.value.replace(/\s\s+/gm, '\n'))

        if(userid)
            _.remove(userq, (x) => x.id === userid)

        return bot.createMessage(ch, { embed: content })
    }

    const toObj = (user, str, clr) => {
        if(typeof str === 'object') {
            str.description = `**${user.username}**, ${str.description}`
            str.color = colors[clr]
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

    let mixpanel = {
        track: () => { }
    }

    if(analytics.mixpanel) {
        try {
            mixpanel = Mixpanel.init(analytics.mixpanel)
        } catch(e) {
            console.log(e)
        }
    }

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
        invite,
        prefix,
        dbl,
        audit: auditc,
        cafe: 'https://discord.gg/xQAxThF', /* support server invite */
        mixpanel,
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
    }

    /* service tick for guilds */
    const gtick = (ctx) => {
        const now = new Date()
        guild.bill_guilds(ctx, now)
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

    /* service tick for audit and transaction cleaning */
    const atick = () => {
        const now = new Date()
        audit.clean_audits(ctx, now)
        guild.clean_trans(ctx, now)
    }

    setInterval(tick.bind({}, ctx), 5000)
    setInterval(gtick.bind({}, ctx), 10000)
    setInterval(qtick.bind({}, ctx), 1000)
    setInterval(htick.bind({}, ctx), 60000 * 2)
    setInterval(atick.bind({}, ctx), 600000)
    //setInterval(htick.bind({}, ctx), 6000)

    if(dbl.token)
        connectDBL(ctx);
    
    /* events */
    mongoose.connection.on('error', err => {
        emitter.emit('error', err)
    })

    bot.on('ready', async event => {
        await bot.editStatus('online', { name: 'commands', type: 2})
        emitter.emit('info', `Bot is ready on **${bot.guilds.size} guild(s)** with **${bot.users.size} user(s)** using **${bot.shards.size} shard(s)**`)
    })

    bot.on('messageCreate', async (msg) => {
        /* skip bot or cooldown users */
        if (msg.author.bot || userq.some(x => x.id === msg.author.id))
            return

        let curprefix = prefix
        const curguild = await guild.fetchOnly(msg.channel.guild)
        if(curguild) {
            curprefix = curguild.prefix || prefix
        }

        if (!msg.content.startsWith(curprefix)) return;
        msg.content = msg.content.toLowerCase()

        try {
            /* create our player reply sending fn */
            const reply = (user, str, clr = 'default') => send(msg.channel.id, toObj(user, str, clr), user.discord_id)

            const setbotmsg = 'guild set bot'
            const setreportmsg = 'guild set report'
            const cntnt = msg.content.trim().substring(curprefix.length)
            if(curguild 
                && !cntnt.includes(setbotmsg)
                && !cntnt.includes(setreportmsg)
                && !cntnt.startsWith('sum')
                && !curguild.botchannels.some(x => x === msg.channel.id)) {

                /* skip cooldown guilds */
                if(guildq.some(x => x === curguild.id))
                    return

                const warnmsg = await send(msg.channel.id, { 
                    description: `**${msg.author.username}**, bot commands are only available in these channels: 
                        ${curguild.botchannels.map(x => `<#${x}>`).join(' ')}
                        \nGuild owner or administrator can add a bot channel by typing \`${curprefix}${setbotmsg}\` in the target channel.`, 
                    footer: { text: `This message will be removed in 10s` },
                    color: colors.red
                })

                try {
                    guildq.push(curguild.id)
                    await new Promise(r => setTimeout(r, 10000))
                    guildq = guildq.filter(x => x != curguild.id)
                    await bot.deleteMessage(warnmsg.channel.id, warnmsg.id)
                } catch(e) { }

                return
            }

            /* fill in additional context data */
            const isolatedCtx = Object.assign({}, ctx, {
                msg, /* current icoming msg object */
                reply, /* quick reply function to the channel */
                globals: {}, /* global parameters */
                discord_guild: msg.channel.guild,  /* current discord guild */
            })

            /* add user to cooldown q */
            userq.push({id: msg.author.id, expires: asdate.add(new Date(), 5, 'seconds')});

            let args = cntnt.split(/ +/)
            let usr = await user.fetchOrCreate(isolatedCtx, msg.author.id, msg.author.username)
            usr.username = usr.username.replace(/\*/gi, '')

            const action = args[0]
            if(ctx.settings.wip && !usr.roles.includes('admin') && !usr.roles.includes('mod')) {
                return reply(usr, 'bot is currently under maintenance. Please check again later |ω･)ﾉ', 'yellow')
            }

            if(usr.ban.full) {
                return reply(usr, `this account was banned permanently.
                    For more information please visit [bot discord](${ctx.cafe})`, 'red')
            }

            isolatedCtx.guild = curguild || await guild.fetchOrCreate(isolatedCtx, usr, msg.channel.guild)
            
            if(isolatedCtx.guild)
                isolatedCtx.guild.lastcmdchannel = msg.channel.id
            
            args.filter(x => x.length === 2 && x[0] === '-').map(x => {
                isolatedCtx.globals[globalArgsMap[x[1]]] = true
            })
            args = args.filter(x => !(x.length === 2 && x[0] === '-' && globalArgsMap.hasOwnProperty(x[1])))
            usr.exp = Math.min(usr.exp, 10**7)
            usr.vials = Math.min(usr.vials, 10**6)

            console.log(`[${usr.username}]: ${msg.content}`)

            ctx.mixpanel.track('Command', {
                distinct_id: usr.discord_id,
                command: action,
                args: args.slice(1).join(' '),
                guild: isolatedCtx.guild? isolatedCtx.guild.id : 'direct',
            })

            await trigger('cmd', isolatedCtx, usr, args, prefix)
            usr.unmarkModified('dailystats')
            await check_all(isolatedCtx, usr, action)
            
        } catch (e) {
            if(e.message === 'Missing Permissions' || e.message === 'Cannot send messages to this user')
                return
            
            if(debug)
                await send(msg.channel.id, { description: e.message, color: colors.red })
            emitter.emit('error', e)
        }
    })

    bot.on('messageReactionAdd', async (msg, emoji, userID) => {
        if (!msg.author || msg.author.id != bot.user.id || userID == bot.user.id)
            return

        try {
            await pgn.trigger(userID, msg, emoji.name)
        } catch (e) {
            emitter.emit('error', e)
        }
    })

    bot.on('error', async (err, sh) => {
        emitter.emit('error', err, sh)
    })

    pgn.emitter.on('resolve', async (res, obj) => {
        if(!res || !obj.channel || !obj.onConfirm)
            return

        const isolatedCtx = Object.assign({}, ctx)
        await new Promise(r => setTimeout(r, 2000))

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
        updatePromos: (promodata) => data.promos = promodata,
        updateBoosts: (boostdata) => data.boosts = boostdata,
        updateWords: (wordsdata) => filter.addWords(...wordsdata)
    }
}
