module.exports = {
    daily: [
        {
            id: 'claim4',
            name: 'Claim 4 cards today',
            desc: '',
            tier: 1,
            actions: ['claim', 'cl'],
            check: (ctx, user) => user.dailystats.claims >= 4,
            resolve: (ctx, user) => {
                user.exp += 500
                user.xp += 2
            },
            reward: (ctx) => `**500** ${ctx.symbols.tomato} and **2** xp`
        }, {
            id: 'claim8',
            name: 'Claim 8 cards today',
            desc: '',
            tier: 2,
            actions: ['claim', 'cl'],
            check: (ctx, user) => user.dailystats.claims >= 8,
            resolve: (ctx, user) => {
                user.exp += 1200
                user.xp += 5
            },
            reward: (ctx) => `**1200** ${ctx.symbols.tomato} and **5** xp`
        }, {
            id: 'bid2',
            name: 'Bid on 2 auctions today',
            desc: '',
            tier: 1,
            actions: ['auc', 'auction'],
            check: (ctx, user) => user.dailystats.bids >= 2,
            resolve: (ctx, user) => {
                user.exp += 900
                user.xp += 2
            },
            reward: (ctx) => `**900** ${ctx.symbols.tomato} and **2** xp`
        }, {
            id: 'bid5',
            name: 'Bid on 4 auctions today',
            desc: '',
            tier: 2,
            actions: ['auc', 'auction'],
            check: (ctx, user) => user.dailystats.bids >= 4,
            resolve: (ctx, user) => {
                user.exp += 1800
                user.xp += 5
            },
            reward: (ctx) => `**1800** ${ctx.symbols.tomato} and **5** xp`
        }, {
            id: 'forge1',
            name: 'Forge 1-star card',
            desc: '',
            tier: 1,
            building: 'smithhub1',
            actions: ['forge'],
            check: (ctx, user) => user.dailystats.forge1 >= 1,
            resolve: (ctx, user) => {
                user.exp += 300
                user.xp += 1
            },
            reward: (ctx) => `**300** ${ctx.symbols.tomato} and **1** xp`
        }, {
            id: 'forge2',
            name: 'Forge 2-star card',
            desc: '',
            tier: 1,
            building: 'smithhub1',
            actions: ['forge'],
            check: (ctx, user) => user.dailystats.forge2 >= 1,
            resolve: (ctx, user) => {
                user.exp += 400
                user.vials += 20
                user.xp += 2
            },
            reward: (ctx) => `**400** ${ctx.symbols.tomato}, **20** ${ctx.symbols.vial} and **2** xp`
        }, {
            id: 'forge3',
            name: 'Forge 3-star card',
            desc: '',
            tier: 2,
            building: 'smithhub1',
            actions: ['forge'],
            check: (ctx, user) => user.dailystats.forge3 >= 1,
            resolve: (ctx, user) => {
                user.exp += 400
                user.vials += 40
                user.xp += 4
            },
            reward: (ctx) => `**400** ${ctx.symbols.tomato}, **40** ${ctx.symbols.vial} and **4** xp`
        }, {
            id: 'tag2',
            name: 'Tag 2 cards',
            desc: '',
            tier: 1,
            actions: ['tag'],
            check: (ctx, user) => user.dailystats.tags >= 2,
            resolve: (ctx, user) => {
                user.exp += 400
                user.xp += 2
            },
            reward: (ctx) => `**400** ${ctx.symbols.tomato} and **2** xp`
        }, {
            id: 'tag4',
            name: 'Tag 4 cards',
            desc: '',
            tier: 2,
            actions: ['tag'],
            check: (ctx, user) => user.dailystats.tags >= 4,
            resolve: (ctx, user) => {
                user.exp += 800
                user.xp += 4
            },
            reward: (ctx) => `**800** ${ctx.symbols.tomato} and **4** xp`
        }, {
            id: 'liq2',
            name: 'Liquify 2 cards',
            desc: '',
            tier: 2,
            building: 'smithhub2',
            actions: ['liq', 'liquify'],
            check: (ctx, user) => user.dailystats.liquify >= 2,
            resolve: (ctx, user) => {
                user.vials += 55
                user.xp += 3
            },
            reward: (ctx) => `**55** ${ctx.symbols.vial} and **3** xp`
        }, {
            id: 'draw2',
            name: 'Draw 2 cards',
            desc: '',
            tier: 2,
            building: 'smithhub2',
            actions: ['draw'],
            check: (ctx, user) => user.dailystats.draw >= 2,
            resolve: (ctx, user) => {
                user.exp += 400
                user.xp += 3
            },
            reward: (ctx) => `**400** ${ctx.symbols.tomato} and **3** xp`
        },
    ],

    getting_started: [],

    upgrade_time: []
}