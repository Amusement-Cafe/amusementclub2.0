/* functions */

const User = require('../collections/user')

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


cmd('inv', ['inventory', 'check'], ({ reply }, user, ...args) => {
    if (user.inventory.length == 0) {
        return reply(user, 'your inventory is empty. Buy something from the `/store`')
    }

    const items = user.inventory
        .map((item, index) => `${index+1}. ${item.name}`)

    return reply(user, items.join(' '))
})
