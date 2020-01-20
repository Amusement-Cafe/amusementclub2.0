const colors    = require('../utils/colors')

const check_achievements = async (ctx, user, action) => {
    const possible = ctx.achievements.filter(x => x.actions.includes(action) && !user.achievements.includes(x.id))
    const complete = possible.filter(x => x.check(ctx, user))[0]

    if(complete) {
        const reward = complete.resolve(ctx, user)
        user.achievements.push(complete.id)
        await user.save()

        return ctx.send(ctx.msg.channel.id, {
            color: colors.blue,
            author: { name: `New Achievement:` },
            title: complete.name,
            description: `(${complete.desc})`,
            thumbnail: { url: `${ctx.baseurl}/achievements/${complete.id}.png` },
            fields: [{
                name: `Reward`,
                value: reward
            }]
        })
    }
}

module.exports = {
    check_achievements
}