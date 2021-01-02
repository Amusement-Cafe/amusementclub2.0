const User      = require('../collections/user')
const _         = require('lodash')
const asdate    = require('add-subtract-date')

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
        user.joined = new Date()
        user.lastdaily = asdate.subtract(new Date(), 1, 'day')

        /* save, and send welcome msg */
        await user.save()
        await ctx.reply(user, `welcome to **Amusement Club!** Please read \`${ctx.prefix}rules\` and use \`${ctx.prefix}help\` to learn more about the game`)
    }

    if(user.username != username) {
        user.username = username
        await user.save()
    }

    return user
}

const fetchOnly = (userid) => {
    return User.findOne({ discord_id: userid })
}

const updateUser = (user, query) => {
    return User.findOneAndUpdate({discord_id: user.discord_id}, query, { returnNewDocument: true })
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

const getQuest = (ctx, user, tier, exclude) => {
    const levels = ctx.guild.buildings.reduce((res, curr) => {
        for(let i=0; i<curr.level; i++)
            res.push(`${curr.id}${i + 1}`)
        return res
    }, [])
    
    const available = ctx.quests.daily.filter(x => 
        (!x.building || levels.includes(x.building))
        && (!exclude || x.id != exclude)
        && x.tier === tier
        && x.id != 'tag2'
        && x.id != 'tag4')

    if(available.length > 0) {
        return _.sample(available)
    }
    
    return _.sample(ctx.quests.daily.filter(x => 
        x.id != exclude
        && x.id != 'tag2'
        && x.id != 'tag4'))
}

module.exports = {
    fetchOrCreate,
    fetchOnly,
    onUsersFromArgs,
    updateUser,
    getQuest
}
