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
