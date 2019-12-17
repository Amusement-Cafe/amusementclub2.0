const User = require('../collections/user')

const fetchOrCreate = async (ctx, userid, username) => {
    let user = await User.findOne({ discord_id: userid })

    if (!user) {
        user = new User()
        user.username = username
        user.discord_id = userid
        user.exp = 3000

        /* save, and send welcome msg */
        await user.save()
        await ctx.reply(user, 'welcome to **amoosement clup**')
    }

    if(user.username != username) {
        user.username = username
        await user.save()
    }

    return user
}

const fetchOnly = async (ctx, userid) => {
    return await User.findOne({ discord_id: userid })
}

module.exports = {
    fetchOrCreate,
    fetchOnly
}
