const User = require('../collections/user')

const {
    getAllUserIDs
} = require('../utils/tools')

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

const fetchOnly = async (userid) => {
    return await User.findOne({ discord_id: userid })
}

const onUsersFromArgs = async (args, callback) => {
    const pa = getAllUserIDs(args)

    if(pa.ids.length === 0)
        throw new Error(`please specify at least one user ID`)

    await Promise.all(pa.ids.map(async x => {
       const target = await fetchOnly(x) 
       await callback(target, pa.args)
    }))
}

module.exports = {
    fetchOrCreate,
    fetchOnly,
    onUsersFromArgs
}
