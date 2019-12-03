/* functions */

const User = require('../collections/user')
const msToTime = require('pretty-ms')
const config = require('../config')

const fetchOrCreate = async (ctx, userid, username) => {
    let user = await User.findOne({ discord_id: userid })

    if (!user) {
        user = new User()
        user.username = username
        user.discord_id = userid

        /* save, and send welcome msg */
        await user.save()
        await ctx.reply(user, 'welcome to **amoosement clup**')
    }

    return user
}

module.exports = {
    fetchOrCreate,
}

/* commands */

const {cmd} = require('../utils/cmd')

cmd('bal', ({ reply }, user) => {
    return reply(user, `you have **${Math.floor(user.exp)}** {currency}`)
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
