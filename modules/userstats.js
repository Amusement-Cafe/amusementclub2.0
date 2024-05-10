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

const getAllStats = async (ctx, user) => UserStats.find({discord_id: user.discord_id}).lean()

/*
Get a static and sorted list of all stats for a user.
Pass a startDate to get stats starting from that time
Otherwise time will default to unix 0
 */
const getTimedStats = async (ctx, user, startDate = new Date(0)) => UserStats.find({discord_id: user.discord_id, daily: {$gte: startDate}}).lean()

// Save a users stats and then check for completed quests and achievements
const saveAndCheck = async (ctx, user, stats) => {
    await stats.save()
    const allStats = await getAllStats(ctx, user)
    await check_all(ctx, user, ctx.action, null, stats, allStats)
}

const formatUserStats = (stat, count) => {
    switch (stat) {
        case 'claims': return {stat: `Card Claims`, count: count}
        case 'promoclaims': return {stat: `Promo Claims`, count: count}
        case 'totalregclaims': return {stat: `Total Normal Claims`, count: count}
        case 'aucsell': return {stat: `Auction Sales`, count: count}
        case 'aucbid': return {stat: `Auction Bids`, count: count}
        case 'aucwin': return {stat: `Auction Wins`, count: count}
        case 'liquefy': return {stat: `Total Liquefied`, count: count}
        case 'liquefy1': return {stat: `1 Star Liquefied`, count: count}
        case 'liquefy2': return {stat: `2 Star Liquefied`, count: count}
        case 'liquefy3': return {stat: `3 Star Liquefied`, count: count}
        case 'draw': return {stat: `Total Drawn`, count: count}
        case 'draw1': return {stat: `1 Star Drawn`, count: count}
        case 'draw2': return {stat: `2 Star Drawn`, count: count}
        case 'draw3': return {stat: `3 Star Drawn`, count: count}
        case 'forge': return {stat: `Total Forged`, count: count}
        case 'forge1': return {stat: `1 Star Forged`, count: count}
        case 'forge2': return {stat: `2 Star Forged`, count: count}
        case 'forge3': return {stat: `3 Star Forged`, count: count}
        case 'tags': return {stat: `Tags`, count: count}
        case 'rates': return {stat: `Cards Rated`, count: count}
        case 'wish': return {stat: `Cards Wished For`, count: count}
        case 'usersell': return {stat: `Sales to Users`, count: count}
        case 'botsell': return {stat: `Sales to Bot`, count: count}
        case 'userbuy': return {stat: `Cards Bought`, count: count}
        case 'tomatoin': return {stat: `Tomatoes Gained`, count: count}
        case 'tomatoout': return {stat: `Tomatoes Spent`, count: count}
        case 'promoin': return {stat: `Promo Gained`, count: count}
        case 'promoout': return {stat: `Promo Spent`, count: count}
        case 'vialin': return {stat: `Vials Gained`, count: count}
        case 'vialout': return {stat: `Vials Spent`, count: count}
        case 'lemonin': return {stat: `Lemons Gained`, count: count}
        case 'lemonout': return {stat: `Lemons Spent`, count: count}
        case 'store': return {stat: `Total Store Purchases`, count: count}
        case 'store1': return {stat: `Purchases From Store 1`, count: count}
        case 'store2': return {stat: `Purchases From Store 2`, count: count}
        case 'store3': return {stat: `Purchases From Store 3`, count: count}
        case 'store4': return {stat: `Purchases From Store 4`, count: count}
        case 't1quests': return {stat: `T1 Quests Completed`, count: count}
        case 't2quests': return {stat: `T2 Quests Completed`, count: count}
        case 't3quests': return {stat: `T3 Quests Completed`, count: count}
        case 't4quests': return {stat: `T4 Quests Completed`, count: count}
        case 't5quests': return {stat: `T5 Quests Completed`, count: count}
        case 't6quests': return {stat: `T6 Quests Completed`, count: count}
        case 'totaldaily': return {stat: 'Total Dailies', count: count}


    }
}

module.exports = {
    formatUserStats,
    getAllStats,
    getStats,
    getStaticStats,
    getTimedStats,
    saveAndCheck
}
