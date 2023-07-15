const Oceanic       = require('oceanic.js')
const Emitter       = require('events')
const Filter        = require('bad-words')
const Mixpanel      = require('mixpanel')
const mongoose      = require('mongoose')

const _             = require('lodash')
const asdate        = require('add-subtract-date')
const sagiri        = require('sagiri')

const commands      = require('./commands')
const colors        = require('./utils/colors')
const pgn           = require('./utils/pagination')
const {check_all}   = require('./modules/secondarycheck')

const {
    trigger,
    con,
} = require('./utils/cmd')

const {
    auction,
    audit,
    user,
    guild,
    hero,
    eval,
    meta,
    plot,
    preferences,
} = require('./modules')

const {
    registerTopggVote,
    registerDblVote,
    registerKofiPayment
} = require("./modules/webhooks")

const {
    updateCompletion
} = require("./modules/collection")

const userq = []
const guildq = []
const cardInfos = []

const bot = new Oceanic.Client({ auth: 'Bot ' + process.env.token})
const shards = new Oceanic.ShardManager(bot, {maxShards: parseInt(process.env.shards) })
let mcn, started, config, sauce, ctx


const fillCardOwnerCount = async (carddata) => {
    const infos = await meta.fetchAllInfos()
    infos.map(x => {
        cardInfos[x.id] = x
    })
}

const fillCardData = (carddata) => {
    config.cards = carddata.map((x, i) => {
        const col = config.data.collections.filter(y => y.id == x.col)[0]
        const ext = x.animated? 'gif' : (col.compressed? 'jpg' : 'png')
        const basePath = `/${col.promo? 'promo':'cards'}/${col.id}/${x.level}_${x.name}.${ext}`
        x.url = config.links.baseurl + basePath
        x.shorturl = config.links.shorturl + basePath
        x.id = i

        if(x.added)
            x.added = Date.parse(x.added)

        return x
    })
}

const calculateDistribution = (cards) => {
    const claimableCount = {
        0: 0,
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0
    }
    cards.map(x => {
        const col = config.data.collections.filter(y => y.id == x.col)[0]
        if (!col.promo && (!col.rarity || col.rarity > 0)) {
            claimableCount[x.level]++
            claimableCount[0]++
        }
    })
    return claimableCount
}

/* create our glorious sending fn */
const send = (interaction, content, userid, components, edit = false) => {
    if(content.description)
        content.description = content.description.replace(/\s\s+/gm, '\n')

    if(content.fields)
        content.fields.map(x => x.value = x.value.replace(/\s\s+/gm, '\n'))

    if(userid)
        _.remove(userq, (x) => x.id === userid)

    if (edit)
        return interaction.editOriginal({ embeds: [content], components: components }).catch(e => process.send({error: e}))

    return interaction.createFollowup({ embeds: [content], components: components }).catch(e => process.send({error: e}))
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
    try {
        const ch = await bot.rest.users.createDM(user.discord_id)
        return ch.createMessage({embeds: [toObj(user, str, clr)]}).catch(e => console.log(e))
    } catch (e) {console.log(e)}
}

const qhelp = (ctx, user, cat) => {
    return send(ctx.interaction, {
        author: { name: `Something went wrong!` },
        description: 'A required argument was not supplied, or something has gone wrong with the command. Check out our documentation page linked with `/help` and if you continue to receive this message please report it in our support discord listed on the main documentation page!',
        color: colors.red,
        footer: { text: `Get a link to the command documentation by running /help!` }
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

const sendPgn = async (ctx, user, pgnObject, userqRemove = true) => {
    try {
        await pgn.addPagination(ctx, pgnObject)
        if (userqRemove)
            _.remove(userq, (x) => x.id === user.discord_id)
    } catch (e) {
        process.send({error: {message: e.message, stack: e.stack}})
    }
    
}

const sendCfm = async (ctx, user, cfmObject, userqRemove = true) => {
    try {
        await pgn.addConfirmation(ctx, cfmObject)
        if (userqRemove)
            _.remove(userq, (x) => x.id === user.discord_id)
    } catch (e) {
        process.send({error: {message: e.message, stack: e.stack}})
        
    }
    
}

const sendCfmPgn = async (ctx, user, cfmPgnObject, userqRemove = true) => {
    try {
        await pgn.addConfirmPagination(ctx, cfmPgnObject)
        if (userqRemove)
            _.remove(userq, (x) => x.id === user.discord_id)
    } catch (e) {
        process.send({error: {message: e.message, stack: e.stack}})
    }
}

/* service tick for checks */
const tick = (ctx) => {
    const now = new Date()
    auction.finish_aucs(ctx, now)
    pgn.timeoutTick()

    if (ctx.autoAuction.userID && !ctx.settings.aucLock)
            auction.autoAuction(ctx)
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
    user.deleteOldQuests(now)
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
    const guildTick     =   setInterval(gtick.bind({}, ctx), 2000)
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

const filter = new Filter()

process.on('message', async (message) => {
    const cmd = _.keys(message)
    await trigger('con', message, null, cmd)
})

con('startup', async (data) => {
    config = data.startup
    mcn = await mongoose.connect(config.bot.database)
    fillCardData(config.data.cards)
    await fillCardOwnerCount(config.cards)
    filter.addWords(...config.data.bannedwords)
    if(config.sourcing.sauceNaoToken) {
        sauce = sagiri(config.sourcing.sauceNaoToken, {
            mask: [9],
            results: 2,
        })
    }

    let mixpanel = {
        track: () => { }
    }

    if(config.analytics.mixpanel) {
        try {
            mixpanel = Mixpanel.init(config.analytics.mixpanel)
        } catch(e) {
            console.log(e)
        }
    }

    /* create our context */
    ctx = {
        mcn, /* mongoose database connection */
        bot, /* created and connected Eris bot instance */
        send, /* a sending function to send stuff to a specific channel */
        sendPgn, /* a sending function to send pagination messages and remove user from cooldown*/
        sendCfm, /* a sending function to send confirmation messages and remove user from cooldown*/
        sendCfmPgn, /* a sending function to send a combination confirmation and pagination message and remove user from cooldown*/
        cards: config.data.cards, /* data with cards */
        collections: config.data.collections, /* data with collections */
        help: require('./staticdata/help'),
        audithelp: require('./staticdata/audithelp'),
        items: require('./staticdata/items'),
        achievements: require('./staticdata/achievements'),
        quests: require('./staticdata/quests'),
        effects: require('./staticdata/effects'),
        slashCmd: require('./staticdata/slashcommands'),
        adminCmd: require('./staticdata/adminslashcommands'),
        adminGuildID: config.bot.adminGuildID,
        promos: config.data.promos.map( x => Object.assign({}, x, {starts: Date.parse(x.starts), expires: Date.parse(x.expires)})),
        boosts: config.data.boosts.map( x => Object.assign({}, x, {starts: Date.parse(x.starts), expires: Date.parse(x.expires)})),
        autoAuction: config.auction.auto,
        auctionFeePercent: config.auction.auctionFeePercent,
        cardInfos,
        filter,
        distribution: calculateDistribution(config.cards),
        direct, /* DM reply function to the user */
        symbols: config.symbols,
        baseurl: config.links.baseurl,
        pgn,
        qhelp,
        links: config.links,
        invite: config.bot.invite,
        prefix: config.bot.prefix,
        uniqueFrequency: config.effects.uniqueFrequency,
        eval: config.evals,
        cafe: 'https://discord.gg/xQAxThF', /* support server invite */
        mixpanel,
        sauce,
        config,
        rng: config.rng,
        guildLogChannel: config.channels.guildLog,
        reportChannel: config.channels.report,
        settings: {
            wip: config.bot.maintenance,
            wipMsg: 'bot is currently under maintenance. Please check again later |ω･)ﾉ',
            aucLock: config.auction.lock
        }
    }
    await bot.connect()
})

con('shutdown', async () => {
    stopTicks()
    await bot.disconnect(false)
    process.exit()
})

con('autorestart', async () => {
    ctx.settings.wip = true
    ctx.settings.wipMsg = `the bot is about to undergo a weekly restart. Please try your command again in a few minutes |ω･)ﾉ`
    await new Promise(res=>setTimeout(res,150000))
    stopTicks()
    await bot.disconnect(false)
    process.exit()
})

con('updateCards', async (carddata) => {
    fillCardData(carddata.updateCards)
    await updateCompletion(ctx, config.cards, ctx.cards)
    ctx.cards = config.cards
})

con('updateCols', (coldata) => ctx.collections = coldata.updateCols)
con('updatePromos', (promodata) => ctx.promos = promodata.updatePromos.map( x => Object.assign({}, x, {starts: Date.parse(x.starts), expires: Date.parse(x.expires)})))
con('updateBoosts', (boostdata) => ctx.boosts = boostdata.updateBoosts.map( x => Object.assign({}, x, {starts: Date.parse(x.starts), expires: Date.parse(x.expires)})))
con('updateWords', (wordsdata) => filter.addWords(...wordsdata.updateWords))

con('vote', (voteData) => {
    try {
        if (voteData.type === 'dbl')
            registerDblVote(ctx, voteData.vote)
        if (voteData.type === 'topgg')
            registerTopggVote(ctx, voteData.vote)
        if (voteData.type === 'kofi')
            registerKofiPayment(ctx, voteData.vote)
    } catch (e) {
        process.send({error: {message: e.message, stack: e.stack}})
    }

})

bot.once('ready', async () => {
    started = true
    const guildCommands = await bot.application.getGuildCommands(ctx.adminGuildID)
    if (guildCommands.length !== ctx.adminCmd.length)
        await bot.application.bulkEditGuildCommands(ctx.adminGuildID, ctx.adminCmd)

    const globalCommands = await bot.application.getGlobalCommands()
    if (globalCommands.length !== ctx.slashCmd.length)
        await bot.application.bulkEditGlobalCommands(ctx.slashCmd)

    await bot.editStatus('online', [{ name: 'commands', type: 2}])
    process.send({info: `Bot is ready on **${bot.guilds.size} guild(s)** with **${bot.users.size} user(s)** using **${bot.shards.size} shard(s)**`})
    ctx.settings.wip = false
    startTicks()
})

bot.on('interactionCreate', async (interaction) => {
    if (!started)
        return
    //Slash Commands
    if (interaction instanceof Oceanic.CommandInteraction) {
        try {
            if (interaction.applicationID !== bot.application.id)
                return

            const interactionUser = interaction.user || interaction.member.user
            if (interactionUser.bot)
                return

            const reply = (user, str, clr = 'default', edit) => send(interaction, toObj(user, str, clr), user.discord_id, [], edit)
            let botUser = await user.fetchOnly(interactionUser.id)


            const curguild = await guild.fetchGuildById(interaction.guildID)

            let base = [interaction.data.name]
            let options = []

            let cursor = interaction.data
            while (cursor.hasOwnProperty('options')) {
                cursor = cursor.options.raw? cursor.options.raw : cursor.options
                cursor.map(x => {
                    if (x.type === 1 || x.type === 2) {
                        base.push(x.name)
                        cursor = x
                    } else if ((x.name === 'global' && x.value) || (x.name === 'local' && x.value)) {
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

                await interaction.defer(64)


                return await interaction.createFollowup({
                    embeds: [{
                        description: `**${interactionUser.username}**, bot commands are only available in these channels: 
                            ${curguild.botchannels.map(x => `<#${x}>`).join(' ')}
                            \nGuild owner or administrator can add a bot channel by typing \`/${setbotmsg}\` in the target channel.`,
                        color: colors.red
                    }]
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
                options,
                interactionUser
            })

            let usr = await user.fetchOrCreate(isolatedCtx, interactionUser.id, interactionUser.globalName || interactionUser.username)
            usr.username = usr.username.replace(/\*/gi, '')
            const cntnt = msg.map(x => x.trim()).join(' ')
            let args = cntnt.split(/ +/)

            if (userq.some(x => x.id === interactionUser.id)) {
                await interaction.defer(64)
                return reply(botUser, 'you are currently on a command cooldown. These last only 5 seconds from your last command, please wait a moment and try your command again!', 'red')
            }

            userq.push({id: interactionUser.id, expires: asdate.add(new Date(), 5, 'seconds')})

            if (ctx.settings.wip && !usr.roles.includes('admin') && !usr.roles.includes('mod')) {
                await interaction.defer()
                return reply(usr, ctx.settings.wipMsg, 'yellow')
            }

            if (usr.ban.full) {
                await interaction.defer()
                return reply(usr, `this account was banned permanently.
                        For more information please visit [bot discord](${ctx.cafe})`, 'red')
            }

            usr.exp = Math.min(usr.exp, 10 ** 7)
            usr.vials = Math.min(usr.vials, 10 ** 6)

            console.log(`${new Date().toLocaleTimeString()} [${usr.username}]: ${cntnt}`)
            if (isolatedCtx.discord_guild)
                isolatedCtx.guild = curguild || await guild.fetchOrCreate(isolatedCtx, usr, interaction.member.guild)

            ctx.mixpanel.track('Command', {
                distinct_id: usr.discord_id,
                command: args,
                guild: isolatedCtx.guild ? isolatedCtx.guild.id : 'direct',
            })
            await trigger('cmd', isolatedCtx, usr, args, isolatedCtx.prefix)
        } catch (e) {
            if(e.message === 'Missing Permissions' || e.message === 'Cannot send messages to this user')
                return
            process.send({error: {message: e.message, stack: e.stack}})
        }
    }

    //Buttons
    if (interaction instanceof Oceanic.ComponentInteraction) {
        try {
            if (interaction.applicationID !== bot.application.id)
                return

            const interactionUser = interaction.user || interaction.member.user

            const reply = (user, str, clr = 'default', edit) => send(interaction, toObj(user, str, clr), user.discord_id, [], edit)
            let isoCtx = Object.assign({}, ctx, {
                reply,
                interaction: interaction,
                discord_guild: interaction.member? interaction.member.guild: null,
                prefix: `/`,
                interactionUser
            })

            let usr = await user.fetchOrCreate(isoCtx, interactionUser.id, interactionUser.globalName || interactionUser.username)
            usr.username = usr.username.replace(/\*/gi, '')
            await trigger('rct', isoCtx, usr, [interaction.data.customID])
        } catch (e) {
            if(e.message === 'Missing Permissions' || e.message === 'Cannot send messages to this user')
                return

            process.send({error: {message: e.message, stack: e.stack}})
        }

    }

    if (interaction instanceof Oceanic.ModalSubmitInteraction) {
        try {
            if (interaction.applicationID !== bot.application.id)
                return

            const interactionUser = interaction.user || interaction.member.user

            let args = []

            interaction.data.components.map(x => {
                if (x.type === 1)
                    x.components.map(y => {
                        args.push(y)
                    })
                else
                    args.push(x)
            })
            const reply = (user, str, clr = 'default', edit) => send(interaction, toObj(user, str, clr), user.discord_id, [], edit)
            let isoCtx = Object.assign({}, ctx, {
                reply,
                interaction: interaction,
                discord_guild: interaction.member? interaction.member.guild: null,
                prefix: `/`,
                interactionUser,
                args
            })

            let usr = await user.fetchOrCreate(isoCtx, interactionUser.id, interactionUser.globalName || interactionUser.username)
            usr.username = usr.username.replace(/\*/gi, '')
            await interaction.defer()
            await trigger('mod', isoCtx, usr, [interaction.data.customID])
        } catch (e) {
            if(e.message === 'Missing Permissions' || e.message === 'Cannot send messages to this user')
                return

            process.send({error: {message: e.message, stack: e.stack}})
        }
    }
})

bot.on('guildCreate', async (guild) => {
    if (ctx.guildLogChannel)
        await bot.rest.channels.createMessage(ctx.guildLogChannel, {embeds: [{
                description:`Invited to a new guild!\nGuild Name: **${guild.name}**\nGuild ID: \`${guild.id}\``,
                color: colors.green,
                thumbnail: {url: guild.iconURL}
            }]})
})

bot.on('guildDelete', async (guild) => {
    if (ctx.guildLogChannel)
        await bot.rest.channels.createMessage(ctx.guildLogChannel, {embeds: [{
                description:`Kicked from guild!\nGuild Name: **${guild.name? guild.name: 'Uncached Guild'}**\nGuild ID: \`${guild.id}\``,
                color: colors.red
            }]})
})



bot.on('error', async (err, sh) => {
    process.send({error: {message: err.message, stack: err.stack}})
})

module.exports.schemas = require('./collections')
module.exports.modules = require('./modules')
