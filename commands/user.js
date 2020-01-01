const msToTime      = require('pretty-ms')
const {cmd}         = require('../utils/cmd')
const {addPagination}     = require('../utils/paginator')
const {claimCost}   = require('../utils/tools')
const colors        = require('../utils/colors')

const {
    formatName,
    withCards,
    withGlobalCards,
    bestMatch,
    parseArgs,
    filter,
    mapUserCards
} = require('../modules/card')

const {
    fetchOnly
} = require('../modules/user')

cmd('bal', ({ reply }, user) => {
    return reply(user, `you have **${Math.floor(user.exp)}** {currency}\nYour next claim will cost **${claimCost(user, 1)}** {currency}`)
})

cmd('inv', ['inventory', 'check'], ({ reply }, user, ...args) => {
    if (user.inventory.length == 0) {
        return reply(user, 'your inventory is empty')
    }

    const items = user.inventory
        .map((item, index) => `${index+1}. ${item.name}`)

    return reply(user, items.join(' '))
})

cmd('daily', async ({ reply }, user) => {
    user.lastdaily = user.lastdaily || new Date(0)

    const now = new Date()
    const future = user.lastdaily
    future.setHours(user.lastdaily.getHours() + 20)

    if(future < now) {
        const amount = 300

        user.lastdaily = now
        user.dailystats = {}
        user.exp += amount
        await user.save()

        return reply(user, `you recieved daily **${amount}** {currency} You now have **${user.exp}** {currency}`)
    }

    return reply(user, `you can claim your daily in **${msToTime(future - now)}**`)
})

cmd('cards', 'li', 'ls', withCards(async (ctx, user, cards, parsedargs) => {
    const pages = []

    cards.map((c, i) => {
        if (i % 15 == 0) pages.push("")
        pages[Math.floor(i/15)] += (formatName(c) + (c.amount > 1? `(x${c.amount})\n` : '\n'))
    })

    return await addPagination(ctx, user, `your cards (${user.cards.length} results)`, pages)
}))

cmd('profile', async (ctx, user, arg1) => {
    if(arg1) user = await fetchOnly(arg1)

    const stamp = user._id.getTimestamp()
    const cards = mapUserCards(ctx, user)
    const stampString = `${stamp.getFullYear()}.${(stamp.getMonth()+1)}.${stamp.getDate()}`

    const resp = []
    resp.push(`Cards: **${user.cards.length}** | Stars: **${cards.map(x => x.level).reduce((a, b) => a + b, 0)}**`)
    resp.push(`In game since: **${stampString}** (${msToTime(new Date() - stamp, {compact: true})})`)

    if(user.roles && user.roles.length > 0)
        resp.push(`Roles: **${user.roles.join(" **|** ")}**`)

    return ctx.send(ctx.msg.channel.id, {
        description: resp.join('\n'),
        color: colors['yellow'],
        author: {
            name: `${user.username} (${user.discord_id})`
        },
        thumbnail: {
            url: ctx.bot.users.filter(x => x.id === user.discord_id)[0].avatarURL
        }
    })
})

cmd('diff', async (ctx, user, ...args) => {
    const pages = []
    const newArgs = parseArgs(ctx, args)

    if(!newArgs.id)
        return ctx.reply(user, `please, include ID of other user`, 'red')

    const otherUser = await fetchOnly(newArgs.id)
    const otherCards = filter(mapUserCards(ctx, otherUser), newArgs)

    if(otherCards.length === 0)
        return ctx.reply(user, `**${otherUser.username}** doesn't have any cards matching this request`, 'red')

    const ids = user.cards.map(x => x.id)
    const diff = otherCards.filter(x => ids.indexOf(x.id) === -1)
        .sort(newArgs.sort)

    if(diff.length === 0)
        return ctx.reply(user, `no different cards found`, 'red')

    diff.map((c, i) => {
        if (i % 15 == 0) pages.push("")
        pages[Math.floor(i/15)] += `${formatName(c)}\n`
    })

    return await addPagination(ctx, user, `your difference with ${otherUser.username} (${user.cards.length} results)`, pages)
})

cmd('miss', withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const pages = []

    const ids = user.cards.map(x => x.id)
    const diff = cards.filter(x => ids.indexOf(x.id) === -1)
        .sort(parsedargs.sort)

    if(diff.length === 0)
        return ctx.reply(user, `you have all cards matching this request!`)

    diff.map((c, i) => {
        if (i % 15 == 0) pages.push("")
        pages[Math.floor(i/15)] += `${formatName(c)}\n`
    })

    return await addPagination(ctx, user, `cards that you don't have (${user.cards.length} results)`, pages)
}))