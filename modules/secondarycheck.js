const asdate    = require('add-subtract-date')
const _         = require("lodash")
const colors    = require('../utils/colors')

const {
    getUserQuests,
    updateUserQuest,
} = require('./user')

const {
    plotPayout,
    getLemonCap,
}   = require('./plot')

const check_achievements = async (ctx, user, action, channelID, stats, allStats) => {
    const possible = ctx.achievements.filter(x => !user.achievements.includes(x.id) && !x.disabled)
    const combinedStats = []
    const statKeys = Object.keys(allStats[0])
    _.pull(statKeys, '_id', 'daily', 'discord_id', 'username', '__v')
    allStats.map(x => {
        statKeys.map(y => combinedStats[y]? combinedStats[y] += x[y]: combinedStats[y] = x[y])
    })
    combinedStats['totaldaily'] = allStats.length
    let complete = (await Promise.all(possible.map(async (x) => await x.check(ctx, user, stats, combinedStats)? x : false))).filter(x => x)
    const rewards = []

    if (complete.length === 1) {
        complete = complete.shift()
        const reward = complete.resolve(ctx, user, stats)
        user.achievements.push(complete.id)
        const cap = await getLemonCap(ctx, user)
        if (user.lemons > cap)
            user.lemons = cap
        await user.save()
        await stats.save()

        ctx.mixpanel.track('Achievement', {
            distinct_id: user.discord_id,
            action: action,
            achievement_name: complete.id,
            user_xp: user.xp,
        })
        await plotPayout(ctx, 'tavern', 1, 25)


        return ctx.bot.createMessage(ctx.interaction.channel.id, {embed: {
            color: colors.blue,
            author: { name: `New Achievement:` },
            title: complete.name,
            description: `\`${complete.desc}\``,
            thumbnail: { url: `${ctx.baseurl}/achievements/${complete.id}.png` },
            fields: [{
                name: `Reward`,
                value: reward
            }],
            footer: {text: `To view your achievements use ${ctx.prefix}achievements`}
        }})

    } else if (complete.length > 1) {
        complete.map(x => {
            rewards.push(`**${x.name}** • \`${x.desc}\`\n> ${x.resolve(ctx, user, stats)}`)
            user.achievements.push(x.id)
        })
        await user.save()
        await stats.save()
        await plotPayout(ctx, 'tavern', 1, complete.length * 25)
        return ctx.bot.createMessage(ctx.interaction.channel.id, {embed: {
            color: colors.blue,
            author: { name: `New Achievements:` },
            description: rewards.join('\n'),
            footer: {text: `To view your achievements use ${ctx.prefix}achievements`}
        }})
    }
}

const check_daily = async (ctx, user, action, channelID, stats, allStats) => {
    const rewards = []
    const complete = []
    const completed = []
    const combinedStats = {
        weekly: [],
        monthly: []
    }
    const quests = await getUserQuests(ctx, user)
    const statKeys = Object.keys(allStats[0])
    const weekly = quests.find(x => x.type === 'weekly' && !x.completed)?.created
    const monthly = quests.find(x => x.type === 'monthly' && !x.completed)?.created

    _.pull(statKeys, '_id', 'daily', 'discord_id', 'username', '__v')
    allStats.map(x => {
        if (x.daily >= asdate.subtract(stats.daily, 7, 'days') && x.daily >= weekly)
            statKeys.map(y => combinedStats.weekly[y]? combinedStats.weekly[y] += x[y]: combinedStats.weekly[y] = x[y])
        if (x.daily >= asdate.subtract(stats.daily, 30, 'days') && x.daily >= monthly)
            statKeys.map(y => combinedStats.monthly[y]? combinedStats.monthly[y] += x[y]: combinedStats.monthly[y] = x[y])
    })

    completed[0] = ctx.quests.daily.filter(x => quests.some(y=> !y.completed && x.id === y.questid && x.check(ctx, user, stats)))
    completed[1] = ctx.quests.weekly.filter(x => quests.some(y => !y.completed && x.id === y.questid && x.check(ctx, user, stats, combinedStats.weekly)))
    completed[2] = ctx.quests.monthly.filter(x => quests.some(y => !y.completed && x.id === y.questid && x.check(ctx, user, stats, combinedStats.monthly)))

    for (let completedQuests of completed) {
        for (const q of completedQuests) {
            const reward = q.resolve(ctx, user, stats)
            stats[`t${q.tier}quests`]++
            await updateUserQuest(ctx, user, q.id, {completed: true})
            rewards.push(q.reward(ctx, stats))
            complete.push(q.name.replace('-star', ctx.symbols.star))

            ctx.mixpanel.track('Quest Complete', {
                distinct_id: user.discord_id,
                quest_id: q.id,
                quest_tier: q.tier,
            })
        }
    }

    if(complete.length === 0)
        return

    await stats.save()
    const cap = await getLemonCap(ctx, user)

    if (user.lemons > cap)
        user.lemons = cap

    await user.save()
    let guildID
    if (channelID)
        guildID = ctx.bot.getChannel(channelID).guild.id

    await plotPayout(ctx,'tavern', 2, 15, guildID, user.discord_id)

    return ctx.bot.createMessage(ctx.interaction.channel.id, {embed: {
            color: colors.green,
            author: {name: `${user.username}, you completed:`},
            description: complete.join('\n'),
            fields: [{
                name: `Rewards`,
                value: rewards.join('\n')
            }]
        }})
}

const check_all = async (ctx, user, action, channelID, stats, allStats) => {
    await check_achievements(ctx, user, action, channelID, stats, allStats)

    if(user.dailyquests.length > 0)
        await check_daily(ctx, user, action, channelID, stats, allStats)
}

module.exports = {
    check_achievements,
    check_daily,
    check_all
}
