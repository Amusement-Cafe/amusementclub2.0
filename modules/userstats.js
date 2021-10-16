const UserStats = require('../collections/userstats')

const {
    check_all,
}   = require('./secondarycheck')

const getStats = async (ctx, user, daily) => {
    let userStats = await UserStats.findOne({discord_id: user.discord_id, daily: daily})

    if (!userStats) {
        userStats = new UserStats()
        userStats.discord_id = user.discord_id
        userStats.username = user.username
    }
    return userStats
}

const saveStats = async (ctx, user, stats) => {
    await stats.save()
    await check_all(ctx, user, ctx.action, null, stats)
}

module.exports = {
    getStats,
}
