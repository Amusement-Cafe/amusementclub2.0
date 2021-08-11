const _ = require('lodash')
const { byAlias, completed } = require('../modules/collection')
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
        passive: true,
        animated: true
    }, {
        id: 'holygrail',
        name: 'The Holy Grail',
        desc: 'Get +25% of vials when liquifying 1 and 2-star cards',
        passive: true,
        animated: true
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
    }, {
        id: 'spellcard',
        name: 'Impossible Spell Card',
        desc: 'Usable effects have 40% less cooldown',
        passive: true
    }, {
        id: 'festivewish',
        name: 'Festival of Wishes',
        desc: 'Get notified when a card on your wishlist is auctioned',
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
            const quest = _.sample(ctx.quests.daily.filter(x => x.tier === 1 && !user.dailyquests.includes(x.id) && x.can_drop))
            if(!quest)
                return { msg: `cannot find a unique quest. Please, complete some quests before using this effect.`, used: false }

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
            if(args.length === 0)
                return { msg: `please specify collection`, used: false }

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
            user.lastcard = card.id
            user.markModified('cards')
            await completed(ctx, user, card)
            await user.save()

            return { msg: `you got ${formatName(card)}`, img: card.url, used: true }
        }
    }, {
        id: 'judgeday',
        name: 'The Judgment Day',
        desc: 'Grants effect of almost any usable card',
        passive: false,
        cooldown: 48,
        use: async (ctx, user, args) => {
            if(args.length === 0)
                return { msg: `please specify effect ID`, used: false }

            const reg = new RegExp(args[0], 'gi')
            effect = ctx.effects.filter(x => !x.passive).find(x => reg.test(x.id))

            if(!effect)
                return { msg: `effect with ID \`${args[0]}\` was not found or it is not usable`, used: false }

            let excludedEffects = ["memoryval", "memoryxmas", "memorybday", "memoryhall", "judgeday"]

            if(excludedEffects.includes(effect.id))
                return { msg: `you cannot use that effect card with Judgment Day`, used: false }

            const res = await effect.use(ctx, user, args.slice(1))
            return res
        }
    }, {
        id: 'claimrecall',
        name: 'Claim Recall',
        desc: 'Claim cost gets recalled by 4 claims, as if they never happened',
        passive: false,
        cooldown: 15,
        use: async (ctx, user) => {
            let validUse = user.dailystats.claims > 4

            if (!validUse)
                return { msg: `you can only use Claim Recall when you have claimed more than 4 cards!`, used: false }

            user.dailystats.claims -= 4

            return { msg: `claim cost has been reset to **${user.dailystats.claims * 50}**`, used: true }
        }
    }, {
        id: 'memoryxmas',
        name: 'Memories of Christmas Cheer',
        desc: 'Gives a random card from Christmas promos',
        passive: false,
        cooldown: 120,
        use: async (ctx, user) => {
            let thisEffect = 'memoryxmas'
            user.effectusecount[thisEffect] += 1
            let card = _.sample(ctx.cards.filter(x => x.col.startsWith("christmas") && x.level < 4))

            if(!card)
                return { msg: `cannot fetch a card from a Christmas collection currently, try again later`, used: false }


            let spaceTime = user.effectusecount[thisEffect] % ctx.uniqueFrequency === 0 && user.effectusecount[thisEffect] !== 0
            if (spaceTime) {
                let oldCard = card
                card = _.sample(ctx.cards.filter(x => x.col.startsWith("christmas") && x.level < 4 && !user.cards.some(y => y.id === x.id)))
                if (!card)
                    card = oldCard
            }
            addUserCard(user, card.id)
            user.lastcard = card.id
            user.markModified('cards')
            user.markModified('effectusecount')
            await completed(ctx, user, card)
            await user.save()

            return { msg: `you got ${formatName(card)}`, img: card.url, used: true }
        }
    }, {
        id: 'memoryhall',
        name: 'Memories of Halloween Frights',
        desc: 'Gives a random card from Halloween promos',
        passive: false,
        cooldown: 120,
        use: async (ctx, user) => {
            let thisEffect = 'memoryhall'
            user.effectusecount[thisEffect] += 1
            let card = _.sample(ctx.cards.filter(x => x.col.startsWith("halloween")))

            if(!card)
                return { msg: `cannot fetch a card from a Halloween collection currently, try again later`, used: false }
            let spaceTime = user.effectusecount[thisEffect] % ctx.uniqueFrequency === 0 && user.effectusecount[thisEffect] !== 0
            if (spaceTime) {
                let oldCard = card
                card = _.sample(ctx.cards.filter(x => x.col.startsWith("halloween") && x.level < 4 && !user.cards.some(y => y.id === x.id)))
                if (!card)
                    card = oldCard
            }
            addUserCard(user, card.id)
            user.lastcard = card.id
            user.markModified('cards')
            user.markModified('effectusecount')
            await completed(ctx, user, card)
            await user.save()

            return { msg: `you got ${formatName(card)}`, img: card.url, used: true }
        }
    }, {
        id: 'memorybday',
        name: 'Memories of Birthdays Past',
        desc: 'Gives a random card from Birthday promos',
        passive: false,
        cooldown: 120,
        use: async (ctx, user) => {
            let thisEffect = 'memorybday'
            user.effectusecount[thisEffect] += 1

            let card = _.sample(ctx.cards.filter(x => x.col.startsWith("birthday")))

            if(!card)
                return { msg: `cannot fetch a card from a Birthday collection currently, try again later`, used: false }

            let spaceTime = user.effectusecount[thisEffect] % ctx.uniqueFrequency === 0 && user.effectusecount[thisEffect] !== 0
            if (spaceTime) {
                let oldCard = card
                card = _.sample(ctx.cards.filter(x => x.col.startsWith("birthday") && x.level < 4 && !user.cards.some(y => y.id === x.id)))
                if (!card)
                    card = oldCard
            }

            addUserCard(user, card.id)
            user.lastcard = card.id
            user.markModified('cards')
            user.markModified('effectusecount')
            await completed(ctx, user, card)
            await user.save()

            return { msg: `you got ${formatName(card)}`, img: card.url, used: true }
        }
    }, {
        id: 'memoryval',
        name: 'Memories of Valentines Day',
        desc: 'Gives a random card from Valentines promos',
        passive: false,
        cooldown: 120,
        use: async (ctx, user) => {
            let thisEffect = 'memoryval'
            user.effectusecount[thisEffect] += 1
            let card = _.sample(ctx.cards.filter(x => x.col.startsWith("valentine")))

            if(!card)
                return { msg: `cannot fetch a card from a Valentine collection currently, try again later`, used: false }


            let spaceTime = user.effectusecount[thisEffect] % ctx.uniqueFrequency === 0 && user.effectusecount[thisEffect] !== 0
            if (spaceTime) {
                let oldCard = card
                card = _.sample(ctx.cards.filter(x => x.col.startsWith("valentine") && x.level < 4 && !user.cards.some(y => y.id === x.id)))
                if (!card)
                    card = oldCard
            }

            addUserCard(user, card.id)
            user.lastcard = card.id
            user.markModified('cards')
            user.markModified('effectusecount')
            await completed(ctx, user, card)
            await user.save()


            return { msg: `you got ${formatName(card)}`, img: card.url, used: true }
        }
    }
]
