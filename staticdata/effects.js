const _ = require('lodash')
const { byAlias } = require('../modules/collection')
const { addUserCard, formatName } = require('../modules/card')

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
        id: 'cakeday',
        name: 'Cake Day',
        desc: 'Get +100 tomatoes in your daily for every claim you did',
        passive: true,
        check: (ctx, user) => {
            return true
        }
    }, {
        id: 'holygrail',
        name: 'The Holy Grail',
        desc: 'Get +25% of vials when liquifying 1 and 2-star cards',
        passive: true,
        check: (ctx, user) => {
            return true
        }
    }, {
        id: 'skyfriend',
        name: 'Skies Of Friendship',
        desc: 'Get 10% tomatoes back from wins on auction',
        passive: true,
        check: (ctx, user) => {
            return true
        }
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
    }
]