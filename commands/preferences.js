const {cmd}     = require('../utils/cmd')
const colors    = require('../utils/colors')

const desc = {
    aucbidme: `someone bid on your auction`,
    aucoutbid: `someone outbid you on the auction`,
    announce: `there is a new bot announcement`,
    daily: `you can claim your daily`,
}

cmd('prefs', (ctx, user) => {
    const cats = []
    cats.push(`\`notify\` **Notifications** (set events that bot can DM you about)`)

    return ctx.reply(user, {
        title: `My Preferences`,
        color: colors.deepgreen,
        description: `available preferences (use \`${ctx.prefix}prefs [id]\`):\n${cats.join('\n')}`,
    })
}).access('dm')

cmd(['prefs', 'notify'], (ctx, user) => {
    const notify = user.prefs.notifications
    const fields = Object.keys(notify).map(x => {
        if(desc.hasOwnProperty(x)) {
            return `\`${notify[x]? ctx.symbols.accept : ctx.symbols.decline} ${x}\` ${desc[x]}`
        }
    }).filter(x => x)

    return ctx.send(ctx.msg.channel.id, {
        title: `Notification Preferences`,
        color: colors.deepgreen,
        description: `Get a DM notification when:\n${fields.join('\n')}\n\n
            Use \`${ctx.prefix}prefs set notify [id] [true/false]\``,
    })
}).access('dm')

cmd(['prefs', 'set', 'notify'], async (ctx, user, type, switcher) => {
    const notify = user.prefs.notifications
    if(!notify.hasOwnProperty(type)) {
        return ctx.reply(user, `notify setting \`{type}\` doesn't exist.`, 'red')
    }

    if(switcher != 'true' && switcher != 'false') {
        return ctx.reply(user, `please use either 'true' or 'false' to enable or disable the setting.` , 'red')
    }

    const enable = switcher == 'true'
    user.prefs.notifications[type] = enable
    await user.save()

    return ctx.reply(user, `preferences saved. You will ${enable? 'now' : '**not**'} get DM notifications when **${desc[type]}**`)
}).access('dm')
