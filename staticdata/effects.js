const _ = require('lodash')
const { byAlias } = require('../modules/collection')
const { addUserCard, formatName } = require('../modules/card')

module.exports = [
    {
        id: 'tohrugift',
        name: 'Gift From Tohru',
        desc: 'Get 3-star card every first claim per day',
        passive: true
    }, {
        id: 'cakeday',
        name: 'Cake Day',
        desc: 'Get +100 tomatoes in your daily for every claim you did',
        passive: true
    }, {
        id: 'holygrail',
        name: 'The Holy Grail',
        desc: 'Get +25% of vials when liquifying 1 and 2-star cards',
        passive: true
    }, {
        id: 'skyfriend',
        name: 'Skies Of Friendship',
        desc: 'Get 10% tomatoes back from wins on auction',
        passive: true
    }, {
        id: 'cherrybloss',
        name: 'Cherry Blossoms',
        desc: 'Any card forge is 50% cheaper',
        passive: true
    }, {
        id: 'onvictory',
        name: 'Onwards To Victory',
        desc: 'Get guild rank points 25% faster',
        passive: true
    }, {
        id: 'rulerjeanne',
        name: 'The Ruler Jeanne',
        desc: 'Get `->daily` every 17 hours instead of 20',
        passive: true
    },

    {
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
    }, {
        id: 'spaceunity',
        name: 'The Space Unity',
        desc: 'Gives random unique card from non-promo collection',
        passive: false,
        cooldown: 40,
        use: async (ctx, user, args) => {
            const name = args.join('').replace(/^-/, '')
            const col = byAlias(ctx, name)[0]
            if(!col)
                return { msg: `collection with ID \`${args.join('')}\` wasn't found`, used: false }

            if(col.promo)
                return { msg: `cannot use this effect on promo collections`, used: false }

            const card = _.sample(ctx.cards.filter(x => x.col === col.id 
                && x.level < 4
                && !user.cards.some(y => y.id === x.id)))

            if(!card)
                return { msg: `cannot fetch unique card from **${col.name}** collection`, used: false }

            addUserCard(user, card.id)
            user.markModified('cards')
            await user.save()

            return { msg: `you got ${formatName(card)}`, img: card.url, used: true }
        }
    }, {
        id: 'judgeday',
        name: 'The Judgment Day',
        desc: 'Grants effect of any useable card',
        passive: false,
        cooldown: 1,
        use: async (ctx, user, args) => {
            const reg = new RegExp(args[0], 'gi')
            effect = ctx.effects.filter(x => !x.passive).find(x => reg.test(x.id))

            if(!effect)
                return { msg: `effect with ID \`${args[0]}\` was not found or it is not usable`, used: false }

            if(effect.id === 'judgeday')
                return { msg: `you cannot use that effect card`, used: false }

            const res = await effect.use(ctx, user, args.slice(1))
            return res
        }
    }
]