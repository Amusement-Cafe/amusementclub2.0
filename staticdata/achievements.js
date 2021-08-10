const {
    formatName,
    addUserCard,
} = require('../modules/card')

const _ = require('lodash')

module.exports = [
    {
        id: 'claimcard',
        name: 'More cards!',
        desc: 'Claim your first card',
        actions: ['claim', 'cl'],
        check: (ctx, user) => user.dailystats.claims > 0,
        resolve: (ctx, user) => {
            user.exp += 200
            return `**200** ${ctx.symbols.tomato}`
        }
    }, {
        id: 'auccard',
        name: 'Playing the Auctions',
        desc: 'Auction your first card',
        actions: ['auc', 'auction'],
        check: (ctx, user) => user.dailystats.aucs > 0,
        resolve: (ctx, user) => {
            user.exp += 400
            return `**400** ${ctx.symbols.tomato}`
        }
    }, {
        id: 'firstdaily',
        name: 'Get the salary',
        desc: 'Get first Daily Bonus',
        actions: ['daily'],
        check: (ctx, user) => new Date() - user.lastdaily < 5000,
        resolve: (ctx, user) => {
            const col = _.sample(ctx.collections.filter(x => !x.promo && !x.rarity))
            const card = _.sample(ctx.cards.filter(x => x.col === col.id && x.level === 3))
            addUserCard(user, card.id)
            return formatName(card)
        }
    }, {
        id: 'allcards',
        name: 'Sketchy Collector!',
        desc: 'Collect All Cards, the Sachi way!',
        actions: ['cl', 'claim', 'cards', 'ls'],
        check: (ctx, user) => user.cards.filter(x => ctx.cards[x.id] && !ctx.cards[x.id].excluded).length 
            >= ctx.cards.filter(x => !x.excluded).length,
        resolve: (ctx, user) => {
            user.exp += 10000
            user.vials += 1000
            user.xp += 100
            return `**10,000** ${ctx.symbols.tomato} and **1,000** ${ctx.symbols.vial}`
        }
    }, {
        id: 'firstforge',
        name: '1+1=1',
        desc: 'Forge cards for the first time',
        actions: ['forge'],
        check: (ctx, user) => user.dailystats.forge1 || user.dailystats.forge2 || user.dailystats.forge3,
        resolve: (ctx, user) => {
            user.vials += 50
            return `**50** ${ctx.symbols.vial}`
        }
    }, {
        id: 'firstliq',
        name: `Didn't need that card anyway`,
        desc: 'Liquify card for the first time',
        actions: ['liq', 'liquify'],
        check: (ctx, user) => user.dailystats.liquify,
        resolve: (ctx, user) => {
            user.vials += 100
            return `**100** ${ctx.symbols.vial}`
        }
    }, {
        id: 'firstdraw',
        name: 'Best Artist Around',
        desc: 'Draw card for the first time',
        actions: ['draw'],
        check: (ctx, user) => user.dailystats.draw,
        resolve: (ctx, user) => {
            user.vials += 100
            return `**100** ${ctx.symbols.vial}`
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
        resolve: (ctx, user) => {
            user.xp += 2
            user.exp += 800
            return `**800** ${ctx.symbols.tomato}`
        }
    }, {
        id: 'firstspecial',
        name: `Well aren't you special?`,
        desc: 'Get a first 4-star',
        actions: ['cl', 'claim'],
        check: (ctx, user) => user.cards.some(x => ctx.cards[x.id] && ctx.cards[x.id].level === 4),
        resolve: (ctx, user) => {
            user.exp += 500
            return `**500** ${ctx.symbols.tomato}`
        }
    }, {
        id: '1000stars',
        name: `Getting star-struck`,
        desc: 'Get 1000 stars',
        actions: ['cl', 'claim'],
        check: (ctx, user) => user.cards.filter(x => ctx.cards[x.id])
            .map(x => ctx.cards[x.id].level)
            .reduce((a, b) => a + b, 0) >= 1000,
        resolve: (ctx, user) => {
            user.exp += 500
            return `**500** ${ctx.symbols.tomato}`
        }
    }, {
        id: 'firsteffect',
        name: `Now that's effective!`,
        desc: 'Create your first effect card',
        actions: ['inv'],
        check: (ctx, user) => {
            const effect = user.effects[0]
            if (effect)
                return true
            return false
        },
        resolve: (ctx, user) => {
            user.exp += 500
            return `**500** ${ctx.symbols.tomato}`
        }
    }


]
