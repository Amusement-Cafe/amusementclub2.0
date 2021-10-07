const User      = require('../collections/user')
const UserCard  = require('../collections/userCard')
const _         = require('lodash')
const asdate    = require('add-subtract-date')

const {
    getAllUserIDs,
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
        let resp = `welcome to **Amusement Club!** Please read \`${ctx.prefix}rules\` and use \`${ctx.prefix}help\` to learn more about the game. `
        resp += `To view a list of cards you have claimed, use \`${ctx.prefix}cards\` or to summon a specific card try \`${ctx.prefix}summon cardName\`. `
        resp += `Using \`${ctx.prefix}daily\` will reset the cost of your claims and give you a small tomato bonus`
        await ctx.reply(user, resp)
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
    const available = ctx.quests.daily.filter(x => 
        (!exclude || x.id != exclude)
        && x.tier === tier
        && x.can_drop)

    if(available.length > 0) {
        return _.sample(available)
    }
    
    return _.sample(ctx.quests.daily.filter(x => 
        x.id != exclude
    ))
}

const getUserCards = (ctx, user) => UserCard.find({ userid: user.discord_id })

const addUserCards = async (ctx, user, cardIds) => {
    const updates = cardIds.map(x => ({
        updateOne: {
            filter: { 
                userid: user.discord_id,
                cardid: x,
            }, 
            update: {
                $inc: { amount: 1 }
            },
            upsert: true,
            setDefaultsOnInsert: true,
        }
    }))

    return await UserCard.bulkWrite(updates)
}

const removeUserCards = async (ctx, user, cardIds) => {
    const res = await UserCard.updateMany({ 
        userid: user.discord_id, 
        cardid: { $in: cardIds },
    }, {
        $inc: { amount: -1 }
    })

    await UserCard.deleteMany({
        userid: user.discord_id,
        amount: 0,
    })

    return res
}

module.exports = {
    fetchOrCreate,
    fetchOnly,
    onUsersFromArgs,
    updateUser,
    getQuest,
    getUserCards,
    addUserCards,
    removeUserCards,
}
