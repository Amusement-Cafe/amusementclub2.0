const colors    = require('../utils/colors')
const User      = require('../collections/user')
const {
    plotPayout,
    getLemonCap,
}   = require('./plot')

const check_achievements = async (ctx, user, action, channelID, stats) => {
    const possible = ctx.achievements.filter(x => !user.achievements.includes(x.id))
    let complete = (await Promise.all(possible.map(async (x) => await x.check(ctx, user, stats)? x : false))).filter(x => x)
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

const check_daily = async (ctx, user, action, channelID, stats) => {
    const rewards = []
    const complete = []

    ctx.quests.daily.filter(x => user.dailyquests.some(y => x.id === y && x.check(ctx, user, stats)))
    .map(x => {
        const reward = x.resolve(ctx, user, stats)
        stats[`t${x.tier}quests`]++
        user.dailyquests = user.dailyquests.filter(y => y != x.id)
        rewards.push(x.reward(ctx))
        complete.push(x.name.replace('-star', ctx.symbols.star))

        ctx.mixpanel.track('Quest Complete', {
            distinct_id: user.discord_id,
            quest_id: x.id,
            quest_tier: x.tier,
        })
    })

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

const check_all = async (ctx, user, action, channelID, stats) => {
    await check_achievements(ctx, user, action, channelID, stats)

    if(user.dailyquests.length > 0)
        await check_daily(ctx, user, action, channelID, stats)
}

module.exports = {
    check_achievements,
    check_daily,
    check_all
}
