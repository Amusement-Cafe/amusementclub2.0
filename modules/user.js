const User      = require('../collections/user')
const UserCard  = require('../collections/userCard')
const UserSlot  = require('../collections/userSlot')
const UserQuest = require("../collections/userQuest");
const _         = require('lodash')
const asdate    = require('add-subtract-date')
const colors    = require('../utils/colors')

const {
    getAllUserIDs,
    XPtoLEVEL,
} = require('../utils/tools')

const fetchOrCreate = async (ctx, userid, username) => {
    let user = await User.findOne({ discord_id: userid })

    if (!user) {
        user = new User()
        user.username = username
        user.discord_id = userid
        user.exp = 3000
        user.vials = 100
        user.joined = new Date()
        user.lastdaily = asdate.subtract(new Date(), 1, 'day')

        /* save, and send welcome msg */
        await user.save()

        for (let i = 0; i < 2; i++) {
            const heroSlot = new UserSlot()
            heroSlot.discord_id = user.discord_id
            await heroSlot.save()
        }
        const embed = {
            color: colors.blue,
            author: { name: `Welcome to Amusement Club!` },
            description: `You are now part of the community card collecting game. Check your \`${ctx.prefix}todo\` list to get started.`,
            fields:[
                {
                    name: `What should you do?`,
                    value: `Claim your first batch of cards using \`${ctx.prefix}claim cards count:4\`. It is recommended to claim 4-6 cards per day.
                        Use \`${ctx.prefix}daily\` to reset your claim price. Now you can \`${ctx.prefix}claim cards\` more cards!
                        Check out your \`${ctx.prefix}quest list\` that you get every time you claim daily.`
                },
                {
                    name: `Moving forward`,
                    value: `View cards you claimed with \`${ctx.prefix}cards\`. You can \`${ctx.prefix}summon\` **any card that you own**.
                        Don't forget to \`${ctx.prefix}fav one\` your favourites!
                        Once you get enough ${ctx.symbols.tomato} or ${ctx.symbols.lemon} check out \`${ctx.prefix}store\` and try buildings and effects.`
                },
                {
                    name: `More information`,
                    value: `Use \`${ctx.prefix}help\` to get help about any command. For example, \`${ctx.prefix}help help_menu:forge\` will give you all information about forge.
                        **Help has been deprecated as of 04/22. Use the [online documentation](https://docs.amusement.cafe/) for all help**
                        Also check out our [how to play guide](https://docs.amusement.cafe/en/getting-started/howto-play) and [online documentation](https://docs.amusement.cafe/).
                        Join the [support server](${ctx.cafe}) to ask any questions.`
                }
            ]
        }
        try {
            await ctx.bot.createMessage(ctx.interaction.channel.id, {embed})
        } catch (e) {
            const dmChannel = await ctx.bot.getDMChannel(userid)
            try {
                embed.description += `\n**This message has been sent as a DM because you have run a command or selected a button in a channel the bot cannot view. Please allow the bot view access to that channel or run commands in a channel the bot can view!**`
                await ctx.bot.createMessage(dmChannel.id, {embed})
            } catch (e) {}
        }

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
    const pa = getAllUserIDs(args.users.split(' '))

    if(pa.ids.length === 0)
        throw new Error(`please specify at least one user ID`)

    await Promise.all(pa.ids.map(async x => {
       const target = await fetchOnly(x) 
       await callback(target, pa.args)
    }))
}

const getDailyQuest = (ctx, user, tier, exclude) => {
    const level = XPtoLEVEL(user.xp)
    const available = ctx.quests.daily.filter(x => 
        (!exclude || x.id.slice(0,-1) != exclude)
        && x.tier === tier
        && x.min_level <= level
        && x.can_drop)

    if(available.length > 0) {
        return _.sample(available)
    }
    
    return _.sample(ctx.quests.daily.filter(x => 
        x.id != exclude
    ))
}

const getWeeklyQuest = (ctx, user, tier, exclude) => {
    const level = XPtoLEVEL(user.xp)
    const available = ctx.quests.weekly.filter(x =>
        (!exclude || x.id != exclude)
        && x.tier === tier
        && x.min_level <= level
        && x.can_drop)

    if(available.length > 0) {
        return _.sample(available)
    }

    return _.sample(ctx.quests.weekly.filter(x =>
        x.id != exclude
    ))
}

const getMonthlyQuest = (ctx, user, tier, exclude) => {
    const level = XPtoLEVEL(user.xp)
    const available = ctx.quests.monthly.filter(x =>
        (!exclude || x.id != exclude)
        && x.tier === tier
        && x.min_level <= level
        && x.can_drop)

    if(available.length > 0) {
        return _.sample(available)
    }

    return _.sample(ctx.quests.monthly.filter(x =>
        x.id != exclude
    ))
}

const deleteOldQuests = async (now) => {
    await UserQuest.deleteMany({expiry: {$lt: now}})
}

const getUserQuests = async (ctx, user) => UserQuest.find({userid: user.discord_id})

const updateUserQuest = async (ctx, user, questid, query) => UserQuest.updateOne({userid: user.discord_id, questid: questid}, query, { returnNewDocument: true })

const deleteDailyQuests = async (ctx, user) => UserQuest.deleteMany({userid: user.discord_id, type: 'daily'})

const getUserCards = (ctx, user) => UserCard.find({ userid: user.discord_id }).lean()

const findUserCards = (ctx, user, cardIds) => UserCard.find({ userid: user.discord_id, cardid: { $in: cardIds } }).lean()

const countUserCards = (ctx, user, cardIds) => UserCard.countDocuments({ userid: user.discord_id, cardid: { $in: cardIds } }).lean()

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
    updateUserQuest,
    getDailyQuest,
    getWeeklyQuest,
    getMonthlyQuest,
    getUserCards,
    getUserQuests,
    deleteDailyQuests,
    deleteOldQuests,
    findUserCards,
    addUserCards,
    removeUserCards,
    countUserCards,
}
