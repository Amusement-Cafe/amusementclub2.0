const Eris      = require('eris')
const mongoose  = require('mongoose')
const colors    = require('./utils/colors')
const {trigger} = require('./utils/cmd')
const {user}    = require('./modules')
const commands  = require('./commands')
const Emitter   = require('events')

module.exports.start = async ({ shareded, database, token, prefix, baseurl, data }) => {
    console.log('[info] intializing connection and starting bot...')

    /* prefill in the urls */
    data.cards = data.cards.map(x => {
        x.url = `${baseurl}/cards/${data.collections[x.collection].name}/${x.level}_${x.name}.${x.animated? 'gif' : 'jpg'}`
        return x
    })

    const mongoUri = database
    const mongoOpt = {useNewUrlParser: true, useUnifiedTopology: true}

    /* basics */
    const mcn = await mongoose.connect(mongoUri, mongoOpt)
    const bot = new Eris(token)

    /* create our glorious sending fn */
    const send = (ch, content) => bot.createMessage(ch, { embed: content })

    /* create our context */
    const ctx = {
        mcn, /* mongoose database connection */
        bot, /* created and connected Eris bot instance */
        send, /* a sending function to send stuff to a specific channel */
    }

    /* events */
    bot.on('ready', async event => {
        //bot.setPresence({ game: { name: '->help' } })

        console.log('[info] bot is ready')
        // await msg('Ready to roll')

        //setInterval(tick.bind(this, ctx), 5000);
    })

    bot.on('messageCreate', async (msg) => {
        if (!msg.content.startsWith(prefix)) return; /* skip not commands */
        if (msg.author.bot) return; /* skip bot users */

        try {
            /* create our player reply sending fn */
            const reply = (user, str, clr = 'default') => send(msg.channel.id, typeof str === 'object'
                ? { description: `**${user.username}**, ${str.description}`, image: { url: str.url }, color: colors[clr] }
                : { description: `**${user.username}**, ${str}`, color: colors[clr] })

            /* fill in additional context data */
            const isolatedCtx = Object.assign({}, ctx, {
                msg, /* current icoming msg object */
                reply, /* quick reply function to the user */
                cards: data.cards, /* data with cards */
                collections: data.collections, /* data with collections */
            })

            const usr  = await user.fetchOrCreate(isolatedCtx, msg.author.id, msg.author.username)
            const args = msg.content.trim().substring(prefix.length).split(' ')

            await trigger('cmd', isolatedCtx, usr, args, prefix)
        } catch (e) {
            const color = e.message.indexOf('Unknown command name') !== -1
                ? colors.yellow /* nice 404 color */
                : colors.red /* nice pure error color */

            send(msg.channel.id, { description: e.message, color })
        }
    })

    bot.on('messageReactionAdd', async (msg, emoji, userID) => {
        if (!msg.author || msg.author.id != bot.user.id || userID == bot.user.id)
            return

        try {
            const isolatedCtx = Object.assign({}, ctx, {
                msg, /* current icoming message */
                userID, /* user who reacted */
                emoji, /* reaction data */
                cards: data.cards, /* data with cards */
                collections: data.collections, /* data with collections */
            })

            console.log(emoji.name)
            await trigger('rct', isolatedCtx, msg.author, [emoji.name])
        } catch (e) {
            send(msg.channel.id, { description: e.message, color: colors.red })
        }
    })

    bot.connect();

    return new Emitter()
}

