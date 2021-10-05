const colors    = require('../utils/colors')
const User      = require('../collections/user')
const {
    plotPayout,
}   = require('./plot')

const check_achievements = async (ctx, user, action, channelID) => {
    const possible = ctx.achievements.filter(x => x.actions.includes(action) && !user.achievements.includes(x.id))
    const complete = (await Promise.all(possible.map(async (x) => await x.check(ctx, user)? x : false))).find(x => x)

    if(complete) {
        const reward = complete.resolve(ctx, user)
        user.achievements.push(complete.id)
        await user.save()

        ctx.mixpanel.track('Achievement', {
            distinct_id: user.discord_id,
            action: action,
            achievement_name: complete.id,
            user_xp: user.xp,
        })
        await plotPayout(ctx, 'tavern', 1, 50)


        return ctx.send(channelID || ctx.msg.channel.id, {
            color: colors.blue,
            author: { name: `New Achievement:` },
            title: complete.name,
            description: `\`${complete.desc}\``,
            thumbnail: { url: `${ctx.baseurl}/achievements/${complete.id}.png` },
            fields: [{
                name: `Reward`,
                value: reward
            }],
            footer: {text: `To view your achievements use ${ctx.prefix}ach`}
        })
    }
}

const check_daily = async (ctx, user, action, channelID) => {
    const rewards = []
    const complete = []

    ctx.quests.daily.filter(x => user.dailyquests.some(y => x.id === y && x.check(ctx, user)))
    .map(x => {
        const reward = x.resolve(ctx, user)
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

    await user.save()
    let guildID
    if (channelID)
        guildID = ctx.bot.getChannel(channelID).guild.id

    await plotPayout(ctx,'tavern', 2, 20, guildID, user.discord_id)

    return ctx.send(channelID || ctx.msg.channel.id, {
        color: colors.green,
        author: { name: `${user.username}, you completed:` },
        description: complete.join('\n'),
        fields: [{
            name: `Rewards`,
            value: rewards.join('\n')
        }]
    })
}

const check_all = async (ctx, user, action, channelID) => {
    await check_achievements(ctx, user, action, channelID)

    if(user.dailyquests.length > 0)
        await check_daily(ctx, user, action, channelID)
}

module.exports = {
    check_achievements,
    check_daily,
    check_all
}
