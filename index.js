const Eris      = require('eris')
const mongoose  = require('mongoose')
const config    = require('./config')
const colors    = require('./utils/colors')
const {trigger} = require('./utils/cmd')
const {user}    = require('./modules')

const mongoUri = config.database
const mongoOpt = {useNewUrlParser: true, useUnifiedTopology: true}

async function main() {
    console.log('[info] intializing connection and starting bot...')

    /* basics */
    const mcn = await mongoose.connect(mongoUri, mongoOpt)
    const bot = new Eris(config.token)

    /* create our glorious sending fn */
    const msg = (ch, content) => new Promise((r, f) => {
        return bot.createMessage(ch, { embed: content })
    })

    /* create our player reply sending fn */
    const rpl = (ch, user, str, clr = 'default') => msg(ch, typeof str === 'object'? 
        { description: `**${user.username}**, ${str.description}`, image: { url: str.url }, color: colors[clr] } : 
        { description: `**${user.username}**, ${str}`, color: colors[clr] })

    /* create our context */
    const ctx = { mcn, bot, msg, rpl }

    /* events */
    bot.on('ready', async event => {
        //bot.setPresence({ game: { name: '->help' } })

        console.log('[info] bot is ready')
        // await msg('Ready to roll')

        //setInterval(tick.bind(this, ctx), 5000);
    })

    bot.on('messageCreate', async (msg) => {
        if (!msg.content.startsWith(config.prefix)) return; /* skip not commands */
        if (msg.author.bot) return; /* skip bot users */

        const usr  = await user.fetchOrCreate(ctx, msg.author.id, msg.author.username)
        const args = msg.content.trim().substring(2).split(' ')

        try {
            await trigger(args, ctx, usr, msg)
        } catch (e) {
            rpl(msg.channel.id, usr, e.message, 'red')
        }
    })

    bot.connect();
}

main().catch(console.error)