const _ = require('lodash')

module.exports = [
    {
        id: 'tohrugift',
        name: 'Gift From Tohru',
        desc: 'Get 3-star card every first claim per day',
        passive: true,
        check: (ctx, user) => {
            return !user.dailystats.claims || user.dailystats.claims === 0
        }
    }, {
        id: 'enayano',
        name: 'Enlightened Ayano',
        desc: 'Completes tier 1 quest when used',
        passive: false,
        cooldown: 20,
        use: async (ctx, user) => {
            const quest = ctx.quests.daily.filter(x => user.dailyquests.includes(x.id)).find(x => x.tier === 1)
            if(!quest)
                return { msg: `you don't have any tier 1 quest to complete`, used: false }

            quest.resolve(ctx, user)
            user.dailyquests = user.dailyquests.filter(y => y != quest.id)
            user.markModified('dailyquests')
            await user.save()

            return { msg: `completed **${quest.name}**. You got ${quest.reward(ctx)}`, used: true }
        }
    }, {
        id: 'pbocchi',
        name: 'Powerful Bocchi',
        desc: 'Generates tier 1 quest when used',
        passive: false,
        cooldown: 32,
        use: async (ctx, user) => {
            const quest = _.sample(ctx.quests.daily.filter(x => x.tier === 1))
            user.dailyquests.push(quest.id)
            user.markModified('dailyquests')
            await user.save()

            return { msg: `received **${quest.name}**`, used: true }
        }
    }
]