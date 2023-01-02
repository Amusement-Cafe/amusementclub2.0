const {
    formatName,
} = require('../modules/card')

const {
    getUserPlots
} = require('../modules/plot')

const {
    addUserCards,
    getUserCards
} = require('../modules/user')

const _      = require('lodash')
const asdate = require('add-subtract-date')

module.exports = [
    {
        id: 'claimcard',
        name: 'More cards!',
        desc: 'Claim your first card',
        actions: ['claim', 'cl'],
        check: (ctx, user, stats) => stats.claims > 0,
        resolve: (ctx, user, stats) => {
            user.exp += 2000
            stats.tomatoin += 2000
            return `**2,000** ${ctx.symbols.tomato}`
        }
    }, {
        id: 'auccard',
        name: 'Playing the Auctions',
        desc: 'Auction your first card',
        actions: ['auc', 'auction'],
        check: (ctx, user, stats) => stats.aucsell > 0,
        resolve: (ctx, user, stats) => {
            user.exp += 1000
            stats.tomatoin += 1000
            return `**1,000** ${ctx.symbols.tomato}`
        }
    }, {
        id: 'firstdaily',
        name: 'Get the salary',
        desc: 'Get first Daily Bonus',
        actions: ['daily'],
        check: (ctx, user) => new Date() - user.lastdaily < 5000,
        resolve: (ctx, user, stats) => {
            const col = _.sample(ctx.collections.filter(x => !x.promo && !x.rarity))
            const card = _.sample(ctx.cards.filter(x => x.col === col.id && x.level === 3))
            addUserCards(ctx, user, [card.id])
            return formatName(card)
        }
    }, {
        id: 'allcards',
        name: 'Sketchy Collector!',
        desc: 'Collect All Cards, the Sachi way!',
        hidden: true,
        actions: ['cl', 'claim', 'cards', 'ls'],
        check: async (ctx, user) => {
            const cards = await getUserCards(ctx, user)
            return cards.filter(x => ctx.cards[x.cardid] && !ctx.cards[x.cardid].excluded) >= ctx.cards.filter(x => !x.excluded).length
        },
        resolve: (ctx, user, stats) => {
            user.exp += 10000
            user.vials += 1000
            user.xp += 100
            stats.tomatoin += 10000
            stats.vialin += 1000
            return `**10,000** ${ctx.symbols.tomato} and **1,000** ${ctx.symbols.vial}`
        }
    }, {
        id: 'firstforge',
        name: '1+1=1',
        desc: 'Forge cards for the first time',
        actions: ['forge'],
        check: (ctx, user, stats) => stats.forge > 0,
        resolve: (ctx, user, stats) => {
            user.vials += 150
            stats.vialin += 150
            return `**150** ${ctx.symbols.vial}`
        }
    }, {
        id: 'firstliq',
        name: `Didn't need that card anyway`,
        desc: 'Liquify card for the first time',
        actions: ['liq', 'liquify'],
        check: (ctx, user, stats) => stats.liquefy > 0,
        resolve: (ctx, user, stats) => {
            user.vials += 1000
            stats.vialin += 1000
            return `**1,000** ${ctx.symbols.vial}`
        }
    }, {
        id: 'firstdraw',
        name: 'Best Artist Around',
        desc: 'Draw card for the first time',
        actions: ['draw'],
        check: (ctx, user, stats) => stats.draw > 0,
        resolve: (ctx, user, stats) => {
            user.vials += 1000
            stats.vialin += 1000
            return `**1,000** ${ctx.symbols.vial}`
        }
    }, {
        id: 'firstreset',
        name: 'Snap your fingers',
        desc: 'Reset collection for the first time',
        actions: ['col', 'collection'],
        check: (ctx, user) => {
            const col = user.cloutedcols.sort((a, b) => b.amount - a.amount)[0]
            if(col)
                return col.amount > 0
            return false
        },
        resolve: (ctx, user, stats) => {
            user.xp += 15
            user.exp += 3000
            stats.tomatoin += 3000
            return `**3,000** ${ctx.symbols.tomato}`
        }
    }, {
        id: 'firstspecial',
        name: `Well aren't you special?`,
        desc: 'Get a first 4-star',
        actions: ['cl', 'claim'],
        check: async (ctx, user) => {
            const cards = await getUserCards(ctx, user)
            return cards.some(x => ctx.cards[x.cardid] && ctx.cards[x.cardid].level === 4)
        },
        resolve: (ctx, user, stats) => {
            user.exp += 500
            stats.tomatoin += 500
            return `**500** ${ctx.symbols.tomato}`
        }
    }, {
        id: '1000stars',
        name: `Getting star-struck`,
        desc: 'Get 1,000 stars',
        actions: ['cl', 'claim'],
        check: async (ctx, user) => {
            const cards = await getUserCards(ctx, user)
            return cards.filter(x => ctx.cards[x.cardid])
                .map(x => ctx.cards[x.cardid].level)
                .reduce((a, b) => a + b, 0) >= 1000
        },
        resolve: (ctx, user, stats) => {
            user.exp += 5000
            stats.tomatoin += 5000
            return `**5,000** ${ctx.symbols.tomato}`
        }
    }, {
        id: 'firsteffect',
        name: `Now that's effective!`,
        desc: 'Create your first effect card',
        actions: ['inv'],
        check: (ctx, user) => {
            return user.effects[0]
        },
        resolve: (ctx, user, stats) => {
            user.exp += 1500
            stats.tomatoin += 1500
            return `**1,500** ${ctx.symbols.tomato}`
        }
    }, {
        id: 'plotcastle',
        name: `Now that's what I call a castle!`,
        desc: 'Build your first castle',
        actions: ['plot', 'plots'],
        check: async (ctx, user) => await getUserPlots(ctx, true, 'castle', user.discord_id).then(x => {return x[0]}),
        resolve: (ctx, user, stats) => {
            user.lemons += 100
            stats.lemonin += 100
            return `**100** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'plotgbank',
        name: `It's not gambling, it's a bank!`,
        desc: 'Build your first gacha bank',
        actions: ['plot', 'plots'],
        check: async (ctx, user) => await getUserPlots(ctx, true, 'gbank', user.discord_id).then(x => {return x[0]}),
        resolve: (ctx, user, stats) => {
            user.lemons += 200
            stats.lemonin += 200
            return `**200** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'plottavern',
        name: `Building these are hard work, have a rest!`,
        desc: 'Build your first tavern',
        actions: ['plot', 'plots'],
        check: async (ctx, user) => await getUserPlots(ctx, true, 'tavern', user.discord_id).then(x => {return x[0]}),
        resolve: (ctx, user, stats) => {
            user.lemons += 400
            stats.lemonin += 400
            return `**400** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'plotsmithhub',
        name: `Strike while the iron is hot!`,
        desc: 'Build your first smithing hub',
        actions: ['plot', 'plots'],
        check: async (ctx, user) => await getUserPlots(ctx, true, 'smithhub', user.discord_id).then(x => {return x[0]}),
        resolve: (ctx, user, stats) => {
            user.lemons += 600
            stats.lemonin += 600
            return `**600** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'plotauchouse',
        name: `Going once! Going twice! SOLD!`,
        desc: 'Build your first auction house',
        actions: ['plot', 'plots'],
        check: async (ctx, user) => await getUserPlots(ctx, true, 'auchouse', user.discord_id).then(x => {return x[0]}),
        resolve: (ctx, user, stats) => {
            user.lemons += 900
            stats.lemonin += 900
            return `**900** ${ctx.symbols.lemon}`
        }
    }, {
        id: '5000stars',
        name: `I'm somewhat of a star myself`,
        desc: 'Get 5,000 stars',
        hidden: true,
        actions: ['claim', 'cl'],
        check: async (ctx, user) => {
            const cards = await getUserCards(ctx, user)
            return cards.filter(x => ctx.cards[x.cardid])
                .map(x => ctx.cards[x.cardid].level)
                .reduce((a, b) => a + b, 0) >= 5000
        },
        resolve: (ctx, user, stats) => {
            user.exp += 7500
            user.lemons += 200
            stats.tomatoin += 7500
            stats.lemonin += 200
            return `**7,500** ${ctx.symbols.tomato} | **200** ${ctx.symbols.lemon}`
        }
    }, {
        id: '10kstars',
        name: `On the road to being an All Star`,
        desc: 'Get 10,000 stars',
        hidden: true,
        actions: ['claim', 'cl'],
        check: async (ctx, user) => {
            const cards = await getUserCards(ctx, user)
            return cards.filter(x => ctx.cards[x.cardid])
                .map(x => ctx.cards[x.cardid].level)
                .reduce((a, b) => a + b, 0) >= 10000
        },
        resolve: (ctx, user, stats) => {
            user.exp += 10000
            user.lemons += 400
            stats.tomatoin += 10000
            stats.lemonin += 400
            return `**10,000** ${ctx.symbols.tomato} | **400** ${ctx.symbols.lemon}`
        }
    }, {
        id: '15kstars',
        name: `All Star Rookie`,
        desc: 'Get 15,000 stars',
        hidden: true,
        actions: ['claim', 'cl'],
        check: async (ctx, user) => {
            const cards = await getUserCards(ctx, user)
            return cards.filter(x => ctx.cards[x.cardid])
                .map(x => ctx.cards[x.cardid].level)
                .reduce((a, b) => a + b, 0) >= 15000
        },
        resolve: (ctx, user, stats) => {
            user.exp += 12500
            user.lemons += 800
            stats.tomatoin += 12500
            stats.lemonin += 800
            return `**12,500** ${ctx.symbols.tomato} | **800** ${ctx.symbols.lemon}`
        }
    }, {
        id: '20kstars',
        name: `All Star Pro`,
        desc: 'Get 20,000 stars',
        hidden: true,
        actions: ['claim', 'cl'],
        check: async (ctx, user) => {
            const cards = await getUserCards(ctx, user)
            return cards.filter(x => ctx.cards[x.cardid])
                .map(x => ctx.cards[x.cardid].level)
                .reduce((a, b) => a + b, 0) >= 20000
        },
        resolve: (ctx, user, stats) => {
            user.exp += 15000
            user.lemons += 900
            stats.tomatoin += 15000
            stats.lemonin += 900
            return `**15,000** ${ctx.symbols.tomato} | **900** ${ctx.symbols.lemon}`
        }
    }, {
        id: '25kstars',
        name: `Hey now, you're an All Star Champion`,
        desc: 'Get 25,000 stars',
        hidden: true,
        actions: ['claim', 'cl'],
        check: async (ctx, user) => {
            const cards = await getUserCards(ctx, user)
            return cards.filter(x => ctx.cards[x.cardid])
                .map(x => ctx.cards[x.cardid].level)
                .reduce((a, b) => a + b, 0) >= 25000
        },
        resolve: (ctx, user, stats) => {
            user.exp += 17500
            user.lemons += 1000
            stats.tomatoin += 17500
            stats.lemonin += 1000
            return `**17,500** ${ctx.symbols.tomato} | **1000** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'firstlegendary',
        name: `Become a legend`,
        desc: 'Acquire your first legendary card',
        actions: ['col', 'ls', 'li', 'cards'],
        check: async (ctx, user) => {
            const cards = await getUserCards(ctx, user)
            return cards.some(x => ctx.cards[x.cardid] && ctx.cards[x.cardid].level === 5)
        },
        resolve: (ctx, user, stats) => {
            user.exp += 1000
            user.lemons += 50
            stats.tomatoin += 1000
            stats.lemonin += 50
            return `**1,000** ${ctx.symbols.tomato} | **50** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'claim10cards',
        name: `Max Claimer`,
        desc: 'Claim 10 cards in a day',
        actions: ['cl', 'claim'],
        check: (ctx, user, stats) => stats.totalregclaims >= 10,
        resolve: (ctx, user, stats) => {
            user.exp += 500
            user.lemons += 10
            stats.tomatoin += 500
            stats.lemonin += 10
            return `**500** ${ctx.symbols.tomato} | **10** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'claim15cards',
        name: `👀`,
        desc: 'Claim 15 cards in a day',
        actions: ['cl', 'claim'],
        check: (ctx, user, stats) => stats.totalregclaims >= 15,
        resolve: (ctx, user, stats) => {
            user.exp += 750
            user.lemons += 15
            stats.tomatoin += 750
            stats.lemonin += 15
            return `**750** ${ctx.symbols.tomato} | **15** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'claim20cards',
        name: `Big Spender`,
        desc: 'Claim 20 cards in a day',
        actions: ['cl', 'claim'],
        check: (ctx, user, stats) => stats.totalregclaims >= 20,
        resolve: (ctx, user, stats) => {
            user.exp += 1000
            user.lemons += 20
            stats.tomatoin += 1000
            stats.lemonin += 20
            return `**1000** ${ctx.symbols.tomato} | **20** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'firstpromo',
        name: `Seasonal Event Participant`,
        desc: 'Claim your first promo card',
        actions: ['cl', 'claim'],
        check: (ctx, user, stats) => {
            const now = new Date()
            const promo = ctx.promos.find(x => x.starts < now && x.expires > now)
            return promo && stats.promoclaims > 0
        },
        resolve: (ctx, user, stats) => {
            const now = new Date()
            const promo = ctx.promos.find(x => x.starts < now && x.expires > now)
            user.promoexp += 50
            user.lemons += 5
            stats.promoin += 50
            stats.lemonin += 5
            return `**50** ${promo.currency} | **5** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'claim5promo',
        name: `Event Rush`,
        desc: 'Claim 5 promo cards in a day',
        actions: ['cl', 'claim'],
        check: (ctx, user, stats) => {
            const now = new Date()
            const promo = ctx.promos.find(x => x.starts < now && x.expires > now)
            return promo && stats.promoclaims >= 5
        },
        resolve: (ctx, user, stats) => {
            const now = new Date()
            const promo = ctx.promos.find(x => x.starts < now && x.expires > now)
            user.promoexp += 100
            user.lemons += 10
            stats.promoin += 100
            stats.lemonin += 10
            return `**100** ${promo.currency} | **10** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'claim10promo',
        name: `Maximum Promo`,
        desc: 'Claim 10 promo cards in a day',
        actions: ['cl', 'claim'],
        check: (ctx, user, stats) => {
            const now = new Date()
            const promo = ctx.promos.find(x => x.starts < now && x.expires > now)
            return promo && stats.promoclaims >= 10
        },
        resolve: (ctx, user, stats) => {
            const now = new Date()
            const promo = ctx.promos.find(x => x.starts < now && x.expires > now)
            user.promoexp += 150
            user.lemons += 20
            stats.promoin += 150
            stats.lemonin += 25
            return `**150** ${promo.currency} | **20** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'forge10cards',
        name: `Prolific Forger`,
        desc: 'Forge 10 times in a day',
        actions: ['forge'],
        check: (ctx, user, stats) => stats.forge >= 10,
        resolve: (ctx, user, stats) => {
            user.exp += 2000
            user.lemons += 250
            stats.tomatoin += 2000
            stats.lemonin += 250
            return `**2000** ${ctx.symbols.tomato} | **250** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'draw8cards',
        name: `Painting happy little cards`,
        desc: 'Draw 6 cards in a day',
        actions: ['draw'],
        check: (ctx, user, stats) => stats.draw >= 6,
        resolve: (ctx, user, stats) => {
            user.vials += 200
            user.lemons += 50
            stats.tomatoin += 200
            stats.lemonin += 50
            return `**200** ${ctx.symbols.vial} | **50** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'draw10cards',
        name: `The Bob Ross of cards`,
        desc: 'Draw 10 cards in a day',
        actions: ['draw'],
        check: (ctx, user, stats) => stats.draw >= 10,
        resolve: (ctx, user, stats) => {
            user.vials += 300
            user.lemons += 75
            stats.tomatoin += 300
            stats.lemonin += 75
            return `**300** ${ctx.symbols.vial} | **75** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'liq10cards',
        name: `There's always a need for more`,
        desc: 'Liquefy 10 cards in a day',
        actions: ['liq', 'liquify'],
        check: (ctx, user, stats) => stats.liquefy >= 10,
        resolve: (ctx, user, stats) => {
            user.exp += 1000
            user.vials += 100
            user.lemons += 25
            stats.tomatoin += 1000
            stats.vialin += 100
            stats.lemonin += 25
            return `**1000** ${ctx.symbols.tomato} | **100** ${ctx.symbols.vial} | **25** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'liq20cards',
        name: `There's no heart in these cards`,
        desc: 'Liquefy 20 cards in a day',
        actions: ['liq', 'liquify'],
        check: (ctx, user, stats) => stats.liquefy >= 20,
        resolve: (ctx, user, stats) => {
            user.exp += 2000
            user.vials += 200
            user.lemons += 50
            stats.tomatoin += 2000
            stats.vialin += 200
            stats.lemonin += 50
            return `**2000** ${ctx.symbols.tomato} | **200** ${ctx.symbols.vial} | **50** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'firstrate',
        name: `Card Critic`,
        desc: 'Rate a card for the first time',
        actions: ['rate'],
        check: (ctx, user, stats) => stats.rates > 0,
        resolve: (ctx, user, stats) => {
            user.exp += 250
            user.lemons += 5
            stats.tomatoin += 250
            stats.lemonin += 5
            return `**250** ${ctx.symbols.tomato} | **5** ${ctx.symbols.lemon}`
        }
    }, {
        id: 'firstwish',
        name: `When you wish upon a card`,
        desc: 'Add a card to your wishlist',
        actions: ['wish', 'wishlist'],
        check: (ctx, user) => user.wishlist.length > 0,
        resolve: (ctx, user, stats) => {
            user.exp += 200
            user.lemons += 5
            stats.tomatoin += 200
            stats.lemonin += 5
            return `**200** ${ctx.symbols.tomato} | **5** ${ctx.symbols.lemon}`
        }
    }, {
        id: '1year',
        name: `Story of seasons`,
        desc: 'Play the bot for a year!',
        hidden: true,
        actions: ['daily', 'profile'],
        check: (ctx, user) => {
            const past = asdate.subtract(new Date(), 1, 'years')
            return user.joined < past
        },
        resolve: (ctx, user, stats) => {
            let card = _.sample(ctx.cards.filter(x => x.col === 'special' && x.level === 4))
            addUserCards(ctx, user, [card.id])
            user.exp += 10000
            user.lemons += 250
            user.vials += 250
            stats.tomatoin += 10000
            stats.vialin += 250
            stats.lemonin += 250
            return `${formatName(card)}\n **10,000** ${ctx.symbols.tomato} | **250** ${ctx.symbols.vial} | **250** ${ctx.symbols.lemon}`
        }
    }, {
        id: '2year',
        name: `It's not an addiction`,
        desc: 'Play the bot for 2 years!',
        hidden: true,
        actions: ['daily', 'profile'],
        check: (ctx, user) => {
            const past = asdate.subtract(new Date(), 2, 'years')
            return user.joined < past
        },
        resolve: (ctx, user, stats) => {
            let card = _.sample(ctx.cards.filter(x => x.col === 'special' && x.level === 4))
            addUserCards(ctx, user, [card.id])
            user.exp += 10000
            user.lemons += 250
            user.vials += 250
            stats.tomatoin += 10000
            stats.vialin += 250
            stats.lemonin += 250
            return `${formatName(card)}\n **10,000** ${ctx.symbols.tomato} | **250** ${ctx.symbols.vial} | **250** ${ctx.symbols.lemon}`
        }
    }, {
        id: '3year',
        name: `Can't stop, Won't stop`,
        desc: 'Play the bot for 3 years!',
        hidden: true,
        actions: ['daily', 'profile'],
        check: (ctx, user) => {
            const past = asdate.subtract(new Date(), 3, 'years')
            return user.joined < past
        },
        resolve: (ctx, user, stats) => {
            let card = _.sample(ctx.cards.filter(x => x.col === 'special' && x.level === 4))
            addUserCards(ctx, user, [card.id])
            user.exp += 10000
            user.lemons += 250
            user.vials += 250
            stats.tomatoin += 10000
            stats.vialin += 250
            stats.lemonin += 250
            return `${formatName(card)}\n **10,000** ${ctx.symbols.tomato} | **250** ${ctx.symbols.vial} | **250** ${ctx.symbols.lemon}`
        }
    }, {
        id: '4year',
        name: `Putting fourth some effort`,
        desc: 'Play the bot for 4 years!',
        hidden: true,
        actions: ['daily', 'profile'],
        check: (ctx, user) => {
            const past = asdate.subtract(new Date(), 4, 'years')
            return user.joined < past
        },
        resolve: (ctx, user, stats) => {
            let card = _.sample(ctx.cards.filter(x => x.col === 'special' && x.level === 4))
            addUserCards(ctx, user, [card.id])
            user.exp += 10000
            user.lemons += 250
            user.vials += 250
            stats.tomatoin += 10000
            stats.vialin += 250
            stats.lemonin += 250
            return `${formatName(card)}\n **10,000** ${ctx.symbols.tomato} | **250** ${ctx.symbols.vial} | **250** ${ctx.symbols.lemon}`
        }
    }, {
        id: '5year',
        name: `Half a decade!`,
        desc: 'Play the bot for 5 years!',
        hidden: true,
        actions: ['daily', 'profile'],
        check: (ctx, user) => {
            const past = asdate.subtract(new Date(), 5, 'years')
            return user.joined < past
        },
        resolve: (ctx, user, stats) => {
            let card = _.sample(ctx.cards.filter(x => x.col === 'special' && x.level === 4))
            addUserCards(ctx, user, [card.id])
            user.exp += 10000
            user.lemons += 250
            user.vials += 250
            stats.tomatoin += 10000
            stats.vialin += 250
            stats.lemonin += 250
            return `${formatName(card)}\n **10,000** ${ctx.symbols.tomato} | **250** ${ctx.symbols.vial} | **250** ${ctx.symbols.lemon}`
        }
    }
]
