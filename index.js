const Eris          = require('eris')
const Emitter       = require('events')
const Filter        = require('bad-words')
const Mixpanel      = require('mixpanel')
const mongoose      = require('mongoose')

const _             = require('lodash')
const asdate        = require('add-subtract-date')
const paginator     = require('discord-paginator')
const sagiri        = require('sagiri')

const commands      = require('./commands')
const colors        = require('./utils/colors')
const {trigger}     = require('./utils/cmd')
const pgn           = require('./utils/pagination')
const {check_all}   = require('./modules/secondarycheck')

const {
    auction,
    audit,
    user,
    guild,
    hero,
    eval,
    webhooks,
    meta,
    preferences,
    plot,
} = require('./modules')

var userq = []
var guildq = []

module.exports.schemas = require('./collections')
module.exports.modules = require('./modules')

module.exports.create = async ({ 
        shards, database, token, prefix, 
        baseurl, shorturl, auditc, debug, 
        maintenance, invite, data, dbl, 
        analytics, evalc, uniqueFrequency,
        metac, auctionLock, guildLogChannel,
        adminGuildID
    }) => {

    const emitter = new Emitter()
    const cardInfos = []

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

    const fillCardOwnerCount = async (carddata) => {
        const infos = await meta.fetchAllInfos()
        infos.map(x => {
            cardInfos[x.id] = x
        })
    }

    /* prefill in the urls */
    fillCardData(data.cards)

    const mongoUri = database

    /* basics */
    const mcn = await mongoose.connect(mongoUri)
    const bot = new Eris(token, { maxShards: shards })
    /* prefill in the card owner count */
    await fillCardOwnerCount(data.cards)

    /* create our glorious sending fn */
    const send = (interaction, content, userid, components, edit = false) => {
        if(content.description)
            content.description = content.description.replace(/\s\s+/gm, '\n')

        if(content.fields)
            content.fields.map(x => x.value = x.value.replace(/\s\s+/gm, '\n'))

        if(userid)
            _.remove(userq, (x) => x.id === userid)

        if (edit)
            return interaction.editOriginalMessage({ embed: content, components: components })

        return interaction.createMessage({ embed: content, components: components })
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
        try {
            return bot.createMessage(ch.id, {embed: toObj(user, str, clr)}).catch(e => console.log(e))
        } catch (e) {}
    }

    const qhelp = (ctx, user, cat) => {
        const help = ctx.help.filter(x => x.type.includes(cat))[0]
        return send(ctx.interaction, {
            author: { name: `Possible options:` },
            fields: help.fields.slice(0, 5).map(x => ({ name: x.title, value: x.description })),
            color: colors.blue,
            footer: { text: `For full information type ->help ${cat} -here` }
        }, user.discord_id)
    }

    const symbols = {
        tomato: '`🍅`',
        vial: '`🍷`',
        lemon: '`🍋`',
        star: '★',
        auc_sbd: '🔹',
        auc_lbd: '🔷',
        auc_sod: '🔸',
        auc_wss: '▫️',
        accept: '✅',
        decline: '❌',
        red_circle: '`🔴`'
    }

    // const pgn = paginator.create({ bot, pgnButtons: ['first', 'last', 'back', 'forward'] })

    const sendPgn = async (ctx, user, pgnObject, userqRemove = true) => {
        await pgn.addPagination(ctx, pgnObject)
        if (userqRemove)
            _.remove(userq, (x) => x.id === user.discord_id)
    }

    const sendCfm = async (ctx, user, cfmObject, userqRemove = true) => {
        await pgn.addConfirmation(ctx, cfmObject)
        if (userqRemove)
            _.remove(userq, (x) => x.id === user.discord_id)
    }

    const sendCfmPgn = async (ctx, user, cfmPgnObject, userqRemove = true) => {
        await pgn.addConfirmPagination(ctx, cfmPgnObject)
        if (userqRemove)
            _.remove(userq, (x) => x.id === user.discord_id)
    }

    const filter = new Filter()
    filter.addWords(...data.bannedwords)

    let sauce;
    if(metac.sauceNaoToken) {
        sauce = sagiri(metac.sauceNaoToken, { 
            mask: [9],
            results: 2,
        })
    }

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
        sendPgn, /* a sending function to send pagination messages and remove user from cooldown*/
        sendCfm, /* a sending function to send confirmation messages and remove user from cooldown*/
        sendCfmPgn, /* a sending function to send a combination confirmation and pagination message and remove user from cooldown*/
        cards: data.cards, /* data with cards */
        collections: data.collections, /* data with collections */
        help: require('./staticdata/help'),
        audithelp: require('./staticdata/audithelp'),
        items: require('./staticdata/items'),
        achievements: require('./staticdata/achievements'),
        quests: require('./staticdata/quests'),
        effects: require('./staticdata/effects'),
        slashCmd: require('./staticdata/slashcommands'),
        adminCmd: require('./staticdata/adminslashcommands'),
        adminGuildID,
        promos: data.promos,
        boosts: data.boosts,
        cardInfos,
        filter,
        direct, /* DM reply function to the user */
        symbols,
        baseurl,
        pgn,
        qhelp,
        invite,
        prefix,
        dbl,
        uniqueFrequency,
        audit: auditc,
        eval: evalc,
        cafe: 'https://discord.gg/xQAxThF', /* support server invite */
        mixpanel,
        sauce,
        settings: {
            wip: maintenance,
            wipMsg: 'bot is currently under maintenance. Please check again later |ω･)ﾉ',
            aucLock: auctionLock
        }
    }

    const globalArgsMap = {
        f: 'force',
    }

    /* service tick for checks */
    const tick = (ctx) => {
        const now = new Date()
        auction.finish_aucs(ctx, now)
        pgn.timeoutTick()
    }

    /* service tick for guilds */
    const gtick = (ctx) => {
        const now = new Date()
        guild.bill_guilds(ctx, now)
        plot.castlePayments(ctx, now)
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
        hero.checkSlots(ctx, now)
    }

    /* service tick for audit and transaction cleaning */
    const atick = () => {
        const now = new Date()
        audit.clean_audits(ctx, now)
        guild.clean_trans(ctx, now)
    }

    const etick = () => {
        eval.checkQueue(ctx)
    }

    const notifytick = () => {
        preferences.notifyCheck(ctx)
    }

    let tickArray, reconnecting

    const startTicks = () => {
        const auctionTick   =   setInterval(tick.bind({}, ctx), 5000)
        const guildTick     =   setInterval(gtick.bind({}, ctx), 10000)
        const userQueueTick =   setInterval(qtick.bind({}, ctx), 1000)
        const heroTick      =   setInterval(htick.bind({}, ctx), 60000 * 5)
        const auditTick     =   setInterval(atick.bind({}, ctx), 600000)
        const evalTick      =   setInterval(etick.bind({}, ctx), eval.queueTick)
        const notifyTick    =   setInterval(notifytick.bind({}, ctx), 6000)
        tickArray = [auctionTick, guildTick, userQueueTick, heroTick, auditTick, evalTick, notifyTick]
    }

    const stopTicks = () => {
        tickArray.map(x => clearInterval(x))
    }

    const startWebhooks = () => {
        webhooks.listen(ctx)
    }

    const stopWebhooks = () => {
        webhooks.stopListener(ctx)
    }

    startTicks()
    startWebhooks()

    const ayanoConnect = () => {
        if (!reconnecting) {
            reconnecting = true
            bot.connect()
            return
        }
        startTicks()
        startWebhooks()
        bot.connect()
    }

    const ayanoDisconnect = () => {
        stopTicks()
        stopWebhooks()
        bot.disconnect()
    }
    
    /* events */
    mongoose.connection.on('error', err => {
        emitter.emit('error', err)
    })

    bot.on('ready', async event => {
        await bot.editStatus('online', { name: 'commands', type: 2})
        emitter.emit('info', `Bot is ready on **${bot.guilds.size} guild(s)** with **${bot.users.size} user(s)** using **${bot.shards.size} shard(s)**`)
        ctx.settings.wip = false

        const guildCommands = await bot.getGuildCommands(adminGuildID)
        if (guildCommands.length !== ctx.adminCmd.length)
            await bot.bulkEditGuildCommands(adminGuildID, ctx.adminCmd)

        const globalCommands = await bot.getCommands()
        if (globalCommands.length !== ctx.slashCmd.length)
            await bot.bulkEditCommands(ctx.slashCmd)
    })

    bot.on('interactionCreate', async (interaction) => {
        //Slash Commands
        if (interaction instanceof Eris.CommandInteraction) {
            try {
                if (interaction.applicationID !== bot.application.id)
                    return

                const interactionUser = interaction.user || interaction.member.user
                if (interactionUser.bot)
                    return

                const reply = (user, str, clr = 'default', edit) => send(interaction, toObj(user, str, clr), user.discord_id, [], edit)
                let botUser = await user.fetchOnly(interactionUser.id)

                if (userq.some(x => x.id === interactionUser.id)) {
                    await interaction.acknowledge(64)
                    return reply(botUser, 'you are currently on a command cooldown. Please wait a moment and try your command again!', 'red')
                }

                const curguild = await guild.fetchGuildById(interaction.guildID)

                let base = [interaction.data.name]
                let options = []

                let cursor = interaction.data
                while (cursor.hasOwnProperty('options')) {
                    cursor = cursor.options
                    cursor.map(x => {
                        if (x.type === 1 || x.type === 2) {
                            base.push(x.name)
                            cursor = x
                        } else if (x.name === 'global' && x.value) {
                            base.push(x.name)
                        } else {
                            options.push(x)
                        }
                    })
                }

                const setbotmsg = 'guild set bot'
                const setreportmsg = 'guild set report'

                if (curguild
                    && !base.join(' ').includes(setbotmsg)
                    && !base.join(' ').includes(setreportmsg)
                    && !base.join(' ').includes('summon')
                    && !base.join(' ').includes('pat')
                    && !curguild.botchannels.some(x => x === interaction.channel.id)) {

                    await interaction.acknowledge(64)


                    return interaction.createMessage({
                        embed: {
                            description: `**${interactionUser.username}**, bot commands are only available in these channels: 
                            ${curguild.botchannels.map(x => `<#${x}>`).join(' ')}
                            \nGuild owner or administrator can add a bot channel by typing \`/${setbotmsg}\` in the target channel.`,
                            color: colors.red
                        }
                    })

                }

                let capitalMsg = base
                let msg = base.map(x => x.toLowerCase())
                const isolatedCtx = Object.assign({}, ctx, {
                    msg, /* current icoming msg object */
                    capitalMsg,
                    reply, /* quick reply function to the channel */
                    globals: {}, /* global parameters */
                    discord_guild: interaction.member ? interaction.member.guild : null,  /* current discord guild */
                    prefix: '/', /* current prefix */
                    interaction: interaction,
                    options
                })

                let usr = await user.fetchOrCreate(isolatedCtx, interactionUser.id, interactionUser.username)
                usr.username = usr.username.replace(/\*/gi, '')
                const cntnt = msg.map(x => x.trim()).join(' ')
                let args = cntnt.split(/ +/)
                userq.push({id: interactionUser.id, expires: asdate.add(new Date(), 3, 'seconds')})

                if (ctx.settings.wip && !usr.roles.includes('admin') && !usr.roles.includes('mod')) {
                    return reply(usr, ctx.settings.wipMsg, 'yellow')
                }

                if (usr.ban.full) {
                    return reply(usr, `this account was banned permanently.
                        For more information please visit [bot discord](${ctx.cafe})`, 'red')
                }

                usr.exp = Math.min(usr.exp, 10 ** 7)
                usr.vials = Math.min(usr.vials, 10 ** 6)

                console.log(`[${usr.username}]: ${cntnt}`)
                if (isolatedCtx.discord_guild)
                    isolatedCtx.guild = curguild || await guild.fetchOrCreate(isolatedCtx, usr, interaction.member.guild)

                ctx.mixpanel.track('Command', {
                    distinct_id: usr.discord_id,
                    command: args,
                    guild: isolatedCtx.guild ? isolatedCtx.guild.id : 'direct',
                })

                await trigger('cmd', isolatedCtx, usr, args, prefix)
            } catch (e) {
                if(e.message === 'Missing Permissions' || e.message === 'Cannot send messages to this user')
                    return

                emitter.emit('error', e)
            }
        }

        //Buttons
        if (interaction instanceof Eris.ComponentInteraction) {
            if (interaction.applicationID !== bot.application.id)
                return

            const interactionUser = interaction.user || interaction.member.user

            const reply = (user, str, clr = 'default') => send(interaction, toObj(user, str, clr), user.discord_id)
            let isoCtx = Object.assign({}, ctx, {
                reply,
                interaction: interaction,
                discord_guild: interaction.member? interaction.member.guild: null
            })

            let usr = await user.fetchOrCreate(isoCtx, interactionUser.id, interactionUser.username)
            usr.username = usr.username.replace(/\*/gi, '')
            await interaction.acknowledge()
            await trigger('rct', isoCtx, null, [interaction.data.custom_id])
        }
    })

    bot.on('guildCreate', async (guild) => {
        if (guildLogChannel)
            await bot.createMessage(guildLogChannel, {embed: {
                description:`Invited to a new guild!\nGuild Name: **${guild.name}**\nGuild ID: \`${guild.id}\``,
                color: colors.green,
                thumbnail: {url: guild.iconURL}
            }})
    })

    bot.on('guildDelete', async (guild) => {
        if (guildLogChannel)
            await bot.createMessage(guildLogChannel, {embed:{
                description:`Kicked from guild!\nGuild Name: **${guild.name? guild.name: 'Uncached Guild'}**\nGuild ID: \`${guild.id}\``,
                color: colors.red
            }})
    })

    bot.on('messageCreate', async (msg) => {
        /* skip bot or cooldown users */
        if (msg.author.bot || userq.some(x => x.id === msg.author.id))
            return

        let curprefix = prefix
        const curguild = await guild.fetchGuild(msg.channel.guild)
        if(curguild) {
            curprefix = curguild.prefix || prefix
        }

        if (!msg.content.startsWith(curprefix)) return;
        let capitalMsg = msg.content.trim().substr(curprefix).split(/ +/)
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
                && !cntnt.startsWith('pat')
                && !curguild.botchannels.some(x => x === msg.channel.id)) {

                /* skip cooldown guilds */
                if(guildq.some(x => x === curguild.id))
                    return

                const warnmsg = await bot.createMessage(msg.channel.id, {embed: {
                    description: `**${msg.author.username}**, bot commands are only available in these channels: 
                        ${curguild.botchannels.map(x => `<#${x}>`).join(' ')}
                        \nGuild owner or administrator can add a bot channel by typing \`${curprefix}${setbotmsg}\` in the target channel.`, 
                    footer: { text: `This message will be removed in 10s` },
                    color: colors.red
                }})

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
                capitalMsg,
                reply, /* quick reply function to the channel */
                globals: {}, /* global parameters */
                discord_guild: msg.channel.guild,  /* current discord guild */
                prefix: curprefix, /* current prefix */
            })
            let args = cntnt.split(/ +/)
            let usr = await user.fetchOrCreate(isolatedCtx, msg.author.id, msg.author.username)
            usr.username = usr.username.replace(/\*/gi, '')
            return bot.createMessage(msg.channel.id, {embed: toObj(usr, `all commands have been moved to slash commands as [verified bots are losing their access to see messages](https://support-dev.discord.com/hc/en-us/articles/4404772028055-Message-Content-Privileged-Intent-for-Verified-Bots) soon.
            Check out discord's \`/\` menu to find our commands!
            Your new command should look something like \`/${args[0]}\``, 'red')})


            
        } catch (e) {
            if(e.message === 'Missing Permissions' || e.message === 'Cannot send messages to this user')
                return
            
            if(debug)
                await send(msg.channel.id, { description: e.message, color: colors.red })
            emitter.emit('error', e)
        }
    })

    bot.on('error', async (err, sh) => {
        emitter.emit('error', err, sh)
    })

    // pgn.emitter.on('resolve', async (res, obj) => {
    //     if(!res || !obj.channel || !obj.onConfirm)
    //         return
    //
    //     const isolatedCtx = Object.assign({}, ctx)
    //     await new Promise(r => setTimeout(r, 2000))
    //
    //     const usr = await user.fetchOnly(obj.userID)
    //     await check_all(isolatedCtx, usr, obj.action, obj.channel)
    // })

    return {
        emitter,
        connect: () => ayanoConnect(),
        disconnect: () => ayanoDisconnect(),
        reconnect: () => bot.disconnect({ reconnect: 'auto' }),
        updateCards: (carddata) => {fillCardData(carddata); ctx.cards = data.cards},
        updateCols: (coldata) => ctx.collections = coldata,
        updatePromos: (promodata) => ctx.promos = promodata,
        updateBoosts: (boostdata) => ctx.boosts = boostdata,
        updateWords: (wordsdata) => filter.addWords(...wordsdata)
    }
}
