module.exports = {
    daily: [
        {
            id: 'claim4',
            name: 'Claim 4 cards today',
            desc: '',
            tier: 1,
            can_drop: true,
            actions: ['claim', 'cl'],
            check: (ctx, user) => user.dailystats.totalregclaims >= 4,
            resolve: (ctx, user) => {
                user.exp += 600
                user.xp += 2
                user.lemons += 15
            },
            reward: (ctx) => `**600** ${ctx.symbols.tomato} | **15** ${ctx.symbols.lemon} | **2** xp`
        }, {
            id: 'claim8',
            name: 'Claim 8 cards today',
            desc: '',
            tier: 2,
            can_drop: true,
            actions: ['claim', 'cl'],
            check: (ctx, user) => user.dailystats.totalregclaims >= 8,
            resolve: (ctx, user) => {
                user.exp += 1400
                user.xp += 5
                user.lemons += 30
            },
            reward: (ctx) => `**1,400** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **5** xp`
        }, {
            id: 'bid2',
            name: 'Bid on 2 auctions today',
            desc: '',
            tier: 1,
            can_drop: true,
            actions: ['auc', 'auction'],
            check: (ctx, user) => user.dailystats.bids >= 2,
            resolve: (ctx, user) => {
                user.exp += 1000
                user.xp += 2
                user.lemons += 15
            },
            reward: (ctx) => `**1,000** ${ctx.symbols.tomato} | **15** ${ctx.symbols.lemon} | **2** xp`
        }, {
            id: 'bid5',
            name: 'Bid on 4 auctions today',
            desc: '',
            tier: 2,
            can_drop: true,
            actions: ['auc', 'auction'],
            check: (ctx, user) => user.dailystats.bids >= 4,
            resolve: (ctx, user) => {
                user.exp += 2000
                user.xp += 8
                user.lemons += 30
            },
            reward: (ctx) => `**2,000** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **8** xp`
        }, {
            id: 'forge1',
            name: 'Forge 1-star card',
            desc: '',
            tier: 1,
            can_drop: true,
            building: 'smithhub1',
            actions: ['forge'],
            check: (ctx, user) => user.dailystats.forge1 >= 1,
            resolve: (ctx, user) => {
                user.exp += 500
                user.xp += 1
                user.lemons += 15
            },
            reward: (ctx) => `**500** ${ctx.symbols.tomato} | **15** ${ctx.symbols.lemon} | **1** xp`
        }, {
            id: 'forge2',
            name: 'Forge 2-star card',
            desc: '',
            tier: 1,
            can_drop: true,
            building: 'smithhub1',
            actions: ['forge'],
            check: (ctx, user) => user.dailystats.forge2 >= 1,
            resolve: (ctx, user) => {
                user.exp += 800
                user.vials += 30
                user.xp += 2
                user.lemons += 15
            },
            reward: (ctx) => `**800** ${ctx.symbols.tomato} | **15** ${ctx.symbols.lemon} | **30** ${ctx.symbols.vial} | **2** xp`
        }, {
            id: 'forge3',
            name: 'Forge 3-star card',
            desc: '',
            tier: 2,
            can_drop: true,
            building: 'smithhub1',
            actions: ['forge'],
            check: (ctx, user) => user.dailystats.forge3 >= 1,
            resolve: (ctx, user) => {
                user.exp += 1000
                user.vials += 40
                user.xp += 5
                user.lemons += 30
            },
            reward: (ctx) => `**1,000** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **40** ${ctx.symbols.vial} | **5** xp`
        }, {
            id: 'tag2',
            name: 'Tag 2 cards',
            desc: '',
            tier: 1,
            can_drop: false,
            actions: ['tag'],
            check: (ctx, user) => user.dailystats.tags >= 2,
            resolve: (ctx, user) => {
                user.exp += 400
                user.xp += 2
            },
            reward: (ctx) => `**400** ${ctx.symbols.tomato} | **2** xp`
        }, {
            id: 'tag4',
            name: 'Tag 4 cards',
            desc: '',
            tier: 2,
            can_drop: false,
            actions: ['tag'],
            check: (ctx, user) => user.dailystats.tags >= 4,
            resolve: (ctx, user) => {
                user.exp += 800
                user.xp += 4
            },
            reward: (ctx) => `**800** ${ctx.symbols.tomato} | **4** xp`
        }, {
            id: 'liq2',
            name: 'Liquefy 2 cards',
            desc: '',
            tier: 2,
            can_drop: true,
            building: 'smithhub2',
            actions: ['liq', 'liquify'],
            check: (ctx, user) => user.dailystats.liquify >= 2,
            resolve: (ctx, user) => {
                user.vials += 60
                user.xp += 3
                user.lemons += 30
            },
            reward: (ctx) => `**60** ${ctx.symbols.vial} | **30** ${ctx.symbols.lemon} | **3** xp`
        }, {
            id: 'liq4',
            name: 'Liquefy 4 cards',
            desc: '',
            tier: 2,
            can_drop: true,
            building: 'smithhub2',
            actions: ['draw'],
            check: (ctx, user) => user.dailystats.liquify >= 4,
            resolve: (ctx, user) => {
                user.vials += 120
                user.xp += 6
                user.lemons += 30
            },
            reward: (ctx) => `**120** ${ctx.symbols.vial} | **30** ${ctx.symbols.lemon} | **6** xp`
        }, {
            id: 'draw2',
            name: 'Draw 2 cards',
            desc: '',
            tier: 2,
            can_drop: true,
            building: 'smithhub2',
            actions: ['draw'],
            check: (ctx, user) => user.dailystats.draw >= 2,
            resolve: (ctx, user) => {
                user.exp += 1500
                user.vials += 60
                user.xp += 3
                user.lemons += 30
            },
            reward: (ctx) => `**1,500** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **60** ${ctx.symbols.vial} | **3** xp`
        }, {
            id: 'draw4',
            name: 'Draw 4 cards',
            desc: '',
            tier: 2,
            can_drop: true,
            building: 'smithhub2',
            actions: ['draw'],
            check: (ctx, user) => user.dailystats.draw >= 4,
            resolve: (ctx, user) => {
                user.exp += 3000
                user.vials += 120
                user.xp += 6
                user.lemons += 30
            },
            reward: (ctx) => `**3,000** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **120** ${ctx.symbols.vial} | **6** xp`
        }, {
            id: 'draw1star',
            name: 'Draw a 1 star card',
            desc: '',
            tier: 1,
            can_drop: true,
            building: 'smithhub2',
            actions: ['draw'],
            check: (ctx, user) => user.dailystats.draw1 >= 1,
            resolve: (ctx, user) => {
                user.exp += 250
                user.vials += 10
                user.xp += 2
                user.lemons += 15
            },
            reward: (ctx) => `**250** ${ctx.symbols.tomato} | **15** ${ctx.symbols.lemon} | **10** ${ctx.symbols.vial} | **3** xp`
        }, {
            id: 'draw2star',
            name: 'Draw a 2 star card',
            desc: '',
            tier: 1,
            can_drop: true,
            building: 'smithhub2',
            actions: ['draw'],
            check: (ctx, user) => user.dailystats.draw2 >= 1,
            resolve: (ctx, user) => {
                user.exp += 750
                user.vials += 25
                user.xp += 3
                user.lemons += 15
            },
            reward: (ctx) => `**750** ${ctx.symbols.tomato} | **15** ${ctx.symbols.lemon} | **25** ${ctx.symbols.vial} | **3** xp`
        }, {
            id: 'draw3star',
            name: 'Draw a 3 star card',
            desc: '',
            tier: 2,
            can_drop: true,
            building: 'smithhub2',
            actions: ['draw'],
            check: (ctx, user) => user.dailystats.draw3 >= 1,
            resolve: (ctx, user) => {
                user.exp += 900
                user.vials += 60
                user.xp += 4
                user.lemons += 30
            },
            reward: (ctx) => `**900** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **60** ${ctx.symbols.vial} | **4** xp`
        },
    ],

    getting_started: [],

    upgrade_time: []
}
