const UserStats = require('../collections/userstats')

const {
    check_all,
}   = require('./secondarycheck')

// Get an editable version of a users stats, used for when something will be changed and saved
const getStats = async (ctx, user, daily) => {
    let userStats = await UserStats.findOne({discord_id: user.discord_id, daily: daily})

    if (!userStats) {
        userStats = new UserStats()
        userStats.discord_id = user.discord_id
        userStats.username = user.username
        userStats.daily = daily || user.lastdaily
    }
    return userStats
}

//Get a static, uneditable version of a users stats. Best for when needed to check against or display
const getStaticStats = async (ctx, user, daily) => {
    let userStats = await UserStats.findOne({discord_id: user.discord_id, daily: daily}).lean()

    if (!userStats) {
        userStats = new UserStats()
        userStats.discord_id = user.discord_id
        userStats.username = user.username
        userStats.daily = daily || user.lastdaily
        await userStats.save()
    }
    return userStats
}

// Save a users stats and then check for completed quests and achievements
const saveAndCheck = async (ctx, user, stats) => {
    await stats.save()
    await check_all(ctx, user, ctx.action, null, stats)
}

module.exports = {
    getStats,
    getStaticStats,
    saveAndCheck
}
