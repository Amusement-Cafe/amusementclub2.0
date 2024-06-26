const _ = require('lodash')
const { byAlias, completed } = require('../modules/collection')
const { formatName } = require('../modules/card')
const { addUserCards, getUserCards, findUserCards, getUserQuests} = require('../modules/user')
const { getStats } = require("../modules/userstats")
const { UserQuest } = require("../collections")
const asdate = require("add-subtract-date")
const { evalCard } = require("../modules/eval")

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
        desc: 'Get `/daily` every 17 hours instead of 20',
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
            let quests = (await getUserQuests(ctx, user)).filter(x => x.type === 'daily' && !x.completed)
            const quest = ctx.quests.daily.find(y => quests?.some(z => z.questid === y.id) && y.tier === 1)
            if(!quest)
                return { msg: `you don't have any tier 1 quest to complete`, used: false }

            let stats = await getStats(ctx, user, user.lastdaily)
            quest.resolve(ctx, user, stats)
            quests = quests.filter(x => x.questid === quest.id)[0]
            await UserQuest.deleteOne(quests)
            stats.t1quests += 1
            await user.save()
            await stats.save()

            return { msg: `completed **${quest.name}**. You got ${quest.reward(ctx)}`, used: true }
        }
    }, {
        id: 'pbocchi',
        name: 'Powerful Bocchi',
        desc: 'Generates tier 1 quest when used',
        passive: false,
        cooldown: 32,
        use: async (ctx, user) => {
            const questList = (await getUserQuests(ctx, user)).filter(x => x.type === 'daily').map(x => x.questid)
            const quest = _.sample(ctx.quests.daily.filter(x => x.tier === 1 && !questList.includes(x.id) && x.can_drop))
            if(!quest)
                return { msg: `cannot find a unique quest. Please, complete some quests before using this effect.`, used: false }

            await UserQuest.create({userid: user.discord_id, questid: quest.id, type: 'daily', expiry: asdate.add(new Date(), 20, 'hours'), created: new Date()})

            return { msg: `received **${quest.name}**`, used: true }
        }
    }, {
        id: 'spaceunity',
        name: 'The Space Unity',
        desc: 'Gives random unique card from non-promo collection',
        passive: false,
        cooldown: 40,
        use: async (ctx, user, args) => {
            if(!args.extraArgs)
                return { msg: `please specify collection in extra_arguments`, used: false }

            const name = args.extraArgs.replace(/^-/, '')
            const col = byAlias(ctx, name)[0]
            if(!col)
                return { msg: `collection with ID \`${args.extraArgs}\` wasn't found`, used: false }

            if(col.promo)
                return { msg: `cannot use this effect on promo collections`, used: false }

            const userCards = await getUserCards(ctx, user)
            const card = _.sample(ctx.cards.filter(x => x.col === col.id 
                && x.level < 4
                && !userCards.some(y => y.cardid === x.id)))

            if(!card)
                return { msg: `cannot fetch unique card from **${col.name}** collection`, used: false }

            await addUserCards(ctx, user, [card.id])
            user.lastcard = card.id
            await completed(ctx, user, [card.id])
            await user.save()
            await evalCard(ctx, card)

            return { msg: `you got ${formatName(card)}`, img: card.url, used: true }
        }
    }, {
        id: 'judgeday',
        name: 'The Judgment Day',
        desc: 'Grants effect of almost any usable card',
        passive: false,
        cooldown: 48,
        use: async (ctx, user, args) => {
            if(!args.extraArgs)
                return { msg: `please specify effect ID in extra_arguments`, used: false }

            const effectArgs = args.extraArgs.split(' ')
            const reg = new RegExp(effectArgs[0], 'gi')
            let effect = ctx.effects.filter(x => !x.passive).find(x => reg.test(x.id))

            if(!effect)
                return { msg: `effect with ID \`${effectArgs[0]}\` was not found or it is not usable`, used: false }

            let excludedEffects = ["memoryval", "memoryxmas", "memorybday", "memoryhall", "judgeday"]

            if(excludedEffects.includes(effect.id))
                return { msg: `you cannot use that effect card with Judgment Day`, used: false }

            args.extraArgs = effectArgs.slice(1).join(' ')
            const res = await effect.use(ctx, user, args)
            return res
        }
    }, {
        id: 'claimrecall',
        name: 'Claim Recall',
        desc: 'Claim cost gets recalled by 4 claims, as if they never happened',
        passive: false,
        cooldown: 15,
        use: async (ctx, user) => {
            let stats = await getStats(ctx, user, user.lastdaily)

            if (stats.claims < 5)
                return { msg: `you can only use Claim Recall when you have claimed more than 4 cards!`, used: false }

            stats.claims -= 4
            await stats.save()
            return { msg: `claim cost has been reset to **${stats.claims * 50}**`, used: true }
        }
    }, {
        id: 'memoryxmas',
        name: 'Memories of Christmas Cheer',
        desc: 'Gives a random 1-3★ card from Christmas promos',
        passive: false,
        cooldown: 120,
        use: async (ctx, user) => {
            user.effectusecount['memoryxmas'] += 1
            const rng = Math.random() < 1 / ctx.uniqueFrequency
            const forceChance = user.effectusecount['memoryxmas'] % ctx.uniqueFrequency === 0 && user.effectusecount['memoryxmas'] !== 0
            const forceSpace = forceChance && !user.effectusecount.xmasspace
            const baseCards = ctx.cards.filter(x => x.col.startsWith("christmas") && x.level < 4)
            let card = _.sample(baseCards)
            let actualMissing = true

            if(!card)
                return { msg: `cannot fetch a card from a Christmas collection currently, try again later`, used: false }

            if (forceSpace || rng) {
                let oldCard = card
                const userCards = await findUserCards(ctx, user, baseCards.map(x => x.id))
                card = _.sample(baseCards.filter(x => !userCards.some(y => y.cardid === x.id)))
                if (!card){
                    actualMissing = false
                    card = oldCard
                }

                if (rng)
                    user.effectusecount.xmasspace = true
            }

            if (forceChance)
                user.effectusecount.xmasspace = false

            await addUserCards(ctx, user, [card.id])
            user.lastcard = card.id
            user.markModified('cards')
            user.markModified('effectusecount')
            await completed(ctx, user, [card.id])
            await user.save()

            return { msg: `you got ${formatName(card)}${(forceSpace || rng) && actualMissing? '.\nThe dice has rolled in your favor, you have gotten a missing card!': ''}`, img: card.url, used: true }
        }
    }, {
        id: 'memoryhall',
        name: 'Memories of Halloween Frights',
        desc: 'Gives a random card from Halloween promos',
        passive: false,
        cooldown: 120,
        use: async (ctx, user) => {
            user.effectusecount['memoryhall'] += 1
            const rng = Math.random() < 1 / ctx.uniqueFrequency
            const forceChance = user.effectusecount['memoryhall'] % ctx.uniqueFrequency === 0 && user.effectusecount['memoryhall'] !== 0
            const forceSpace = forceChance && !user.effectusecount.hallspace
            const baseCards = ctx.cards.filter(x => x.col.startsWith("halloween") && x.level < 4)
            let card = _.sample(baseCards)
            let actualMissing = true

            if(!card)
                return { msg: `cannot fetch a card from a Halloween collection currently, try again later`, used: false }

            if (forceSpace || rng) {
                let oldCard = card
                const userCards = await findUserCards(ctx, user, baseCards.map(x => x.id))
                card = _.sample(baseCards.filter(x => !userCards.some(y => y.cardid === x.id)))
                if (!card){
                    actualMissing = false
                    card = oldCard
                }
                if (rng)
                    user.effectusecount.hallspace = true
            }

            if (forceChance)
                user.effectusecount.hallspace = false

            await addUserCards(ctx, user, [card.id])
            user.lastcard = card.id
            user.markModified('cards')
            user.markModified('effectusecount')
            await completed(ctx, user, [card.id])
            await user.save()

            return { msg: `you got ${formatName(card)}${(forceSpace || rng) && actualMissing? '.\nThe dice has rolled in your favor, you have gotten a missing card!': ''}`, img: card.url, used: true }
        }
    }, {
        id: 'memorybday',
        name: 'Memories of Birthdays Past',
        desc: 'Gives a random card from Birthday promos',
        passive: false,
        cooldown: 120,
        use: async (ctx, user) => {
            user.effectusecount['memorybday'] += 1
            const rng = Math.random() < 1 / ctx.uniqueFrequency
            const forceChance = user.effectusecount['memorybday'] % ctx.uniqueFrequency === 0 && user.effectusecount['memorybday'] !== 0
            const forceSpace = forceChance && !user.effectusecount.bdayspace
            const baseCards = ctx.cards.filter(x => x.col.startsWith("birthday") && x.level < 4)
            let card = _.sample(baseCards)
            let actualMissing = true

            if(!card)
                return { msg: `cannot fetch a card from a Birthday collection currently, try again later`, used: false }

            if (forceSpace || rng) {
                let oldCard = card
                const userCards = await findUserCards(ctx, user, baseCards.map(x => x.id))
                card = _.sample(baseCards.filter(x => !userCards.some(y => y.cardid === x.id)))
                if (!card){
                    actualMissing = false
                    card = oldCard
                }

                if (rng)
                    user.effectusecount.bdayspace = true
            }

            if (forceChance)
                user.effectusecount.bdayspace = false

            await addUserCards(ctx, user, [card.id])
            user.lastcard = card.id
            user.markModified('cards')
            user.markModified('effectusecount')
            await completed(ctx, user, [card.id])
            await user.save()

            return { msg: `you got ${formatName(card)}${(forceSpace || rng) && actualMissing? '.\nThe dice has rolled in your favor, you have gotten a missing card!': ''}`, img: card.url, used: true }
        }
    }, {
        id: 'memoryval',
        name: 'Memories of Valentines Day',
        desc: 'Gives a random card from Valentines promos',
        passive: false,
        cooldown: 120,
        use: async (ctx, user) => {
            user.effectusecount['memoryval'] += 1
            const rng = Math.random() < 1 / ctx.uniqueFrequency
            const forceChance = user.effectusecount['memoryval'] % ctx.uniqueFrequency === 0 && user.effectusecount['memoryval'] !== 0
            const forceSpace = forceChance && !user.effectusecount.valspace
            const baseCards = ctx.cards.filter(x => x.col.startsWith("valentine") && x.level < 4)
            let card = _.sample(baseCards)
            let actualMissing = true

            if(!card)
                return { msg: `cannot fetch a card from a Valentine collection currently, try again later`, used: false }

            if (forceSpace || rng) {
                let oldCard = card
                const userCards = await findUserCards(ctx, user, baseCards.map(x => x.id))
                card = _.sample(baseCards.filter(x => !userCards.some(y => y.cardid === x.id)))
                if (!card) {
                    actualMissing = false
                    card = oldCard
                }

                if (rng)
                    user.effectusecount.valspace = true
            }

            if (forceChance)
                user.effectusecount.valspace = false

            await addUserCards(ctx, user, [card.id])
            user.lastcard = card.id
            user.markModified('cards')
            user.markModified('effectusecount')
            await completed(ctx, user, [card.id])
            await user.save()


            return { msg: `you got ${formatName(card)}${(forceSpace || rng) && actualMissing? '.\nThe dice has rolled in your favor, you have gotten a missing card!': ''}`, img: card.url, used: true }
        }
    }
]
