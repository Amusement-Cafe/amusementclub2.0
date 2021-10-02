module.exports = {
    daily: [
        {
            id: 'claim4',
            name: 'Claim 4 cards today',
            desc: 'Claim cards using `->claim` command. Example: `->claim 4`',
            tier: 1,
            can_drop: true,
            min_level: 0,
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
            desc: 'Claim cards using `->claim` command. Example: `->claim 8`',
            tier: 2,
            can_drop: true,
            min_level: 10,
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
            desc: 'Use auction to complete this quest. Find an auction you like using `->auc`. Bid successfully on one of the auctions using auction ID and price with prefix `:`. Example: `->auc bid xhgr :100`. Try bidding higher if you get instantly outbid!',
            tier: 1,
            can_drop: true,
            min_level: 15,
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
            desc: 'Use auction to complete this quest. Find an auction you like using `->auc`. Bid successfully on one of the auctions using auction ID and price with prefix `:`. Example: `->auc bid xhgr :100`. Try bidding higher if you get instantly outbid!',
            tier: 2,
            can_drop: true,
            min_level: 50,
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
            desc: 'Use forge to complete this quest. Forge allows you to merge two cards and get one. See list of your cards using `->cards` and find two 1-star cards that you don\'t need/like and then forge them together. Keep in mind that you can only forge cards with the same amount of stars. Example: `->forge eat them all, tsundere side`. If you have multiples of some card, you can also use `->forge -1 -multi` and let system choose cards for you (only multiples will be chosen).',
            tier: 1,
            can_drop: true,
            min_level: 0,
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
            desc: 'Use forge to complete this quest. Forge allows you to merge two cards and get one. See list of your cards using `->cards` and find two 2-star cards that you don\'t need/like and then forge them together. Keep in mind that you can only forge cards with the same amount of stars. Example: `->forge eat them all, tsundere side`. If you have multiples of some card, you can also use `->forge -2 -multi` and let system choose cards for you (only multiples will be chosen).',
            tier: 1,
            can_drop: true,
            min_level: 5,
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
            desc: 'Use forge to complete this quest. Forge allows you to merge two cards and get one. See list of your cards using `->cards` and find two 3-star cards that you don\'t need/like and then forge them together. Keep in mind that you can only forge cards with the same amount of stars. Example: `->forge eat them all, tsundere side`. If you have multiples of some card, you can also use `->forge -3 -multi` and let system choose cards for you (only multiples will be chosen)',
            tier: 2,
            can_drop: true,
            min_level: 15,
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
            min_level: 15,
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
            min_level: 25,
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
            desc: 'Use liquefy to complete this quest. Liquefy allows you to convert cards into vials that are used to draw cards that you want. See list of your cards using `->cards` and find a card that you don\'t need/like and then liquefy it. Example: `->liq eat them all`. Do this 2 times for different cards.',
            tier: 2,
            can_drop: true,
            min_level: 10,
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
            desc: 'Use liquefy to complete this quest. Liquefy allows you to convert cards into vials that are used to draw cards that you want. See list of your cards using `->cards` and find a card that you don\'t need/like and then liquefy it. Example: `->liq eat them all`. Do this 4 times for different cards.',
            tier: 2,
            can_drop: true,
            min_level: 35,
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
            desc: 'Use draw to complete this quest. With draw you can get any card that you want as long as you know the name. Search for a card using `->search` (e.g. `->search tohru` or `->search -touhou` or `->search #keqing`) then draw any card from the list. Example: `->draw thundering might`. Do this 2 times.',
            tier: 2,
            can_drop: true,
            min_level: 20,
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
            desc: 'Use draw to complete this quest. With draw you can get any card that you want as long as you know the name. Search for a card using `->search` (e.g. `->search tohru` or `->search -touhou` or `->search #keqing`) then draw any card from the list. Example: `->draw thundering might`. Do this 4 times.',
            tier: 2,
            can_drop: true,
            min_level: 40,
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
            desc: 'Use draw to complete this quest. With draw you can get any card that you want as long as you know the name. This quest requires specific rarity of card (1). Search for a card using `->search` (e.g. `->search -1 tohru` or `->search -1 -touhou` or `->search -1 #keqing`) then draw any card from the list. Example: `->draw purple gold`.',
            tier: 1,
            can_drop: true,
            min_level: 5,
            building: 'smithhub2',
            actions: ['draw'],
            check: (ctx, user) => user.dailystats.draw1 >= 1,
            resolve: (ctx, user) => {
                user.exp += 250
                user.vials += 25
                user.xp += 2
                user.lemons += 15
            },
            reward: (ctx) => `**250** ${ctx.symbols.tomato} | **15** ${ctx.symbols.lemon} | **10** ${ctx.symbols.vial} | **3** xp`
        }, {
            id: 'draw2star',
            name: 'Draw a 2 star card',
            desc: 'Use draw to complete this quest. With draw you can get any card that you want as long as you know the name. This quest requires specific rarity of card (2). Search for a card using `->search` (e.g. `->search -2 tohru` or `->search -2 -touhou` or `->search -2 #keqing`) then draw any card from the list. Example: `->draw sacrificial sword`.',
            tier: 1,
            can_drop: true,
            min_level: 15,
            building: 'smithhub2',
            actions: ['draw'],
            check: (ctx, user) => user.dailystats.draw2 >= 1,
            resolve: (ctx, user) => {
                user.exp += 750
                user.vials += 75
                user.xp += 3
                user.lemons += 15
            },
            reward: (ctx) => `**750** ${ctx.symbols.tomato} | **15** ${ctx.symbols.lemon} | **25** ${ctx.symbols.vial} | **3** xp`
        }, {
            id: 'draw3star',
            name: 'Draw a 3 star card',
            desc: 'Use draw to complete this quest. With draw you can get any card that you want as long as you know the name. This quest requires specific rarity of card (3). Search for a card using `->search` (e.g. `->search -3 tohru` or `->search -3 -touhou` or `->search -3 #keqing`) then draw any card from the list. Example: `->draw icy harmony `.',
            tier: 2,
            can_drop: true,
            min_level: 25,
            building: 'smithhub2',
            actions: ['draw'],
            check: (ctx, user) => user.dailystats.draw3 >= 1,
            resolve: (ctx, user) => {
                user.exp += 900
                user.vials += 200
                user.xp += 4
                user.lemons += 30
            },
            reward: (ctx) => `**900** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **60** ${ctx.symbols.vial} | **4** xp`
        }, {
            id: 'rate2',
            name: 'Rate 2 cards today',
            desc: 'Use rating system to complete this quest. You can rate any card that you own. Rating is your personal, however average rating is calculated too. To see cards that you did not rate yer, use `->cards !rated`. Choose one card and rate it from 1 to 10 with prefix `:`. Example `->rate icy harmony :10`. Do this 2 times. Re-rating cards doesn\'t count.',
            tier: 1,
            can_drop: true,
            min_level: 0,
            actions: ['rate'],
            check: (ctx, user) => user.dailystats.rates >= 2,
            resolve: (ctx, user) => {
                user.exp += 250
                user.xp += 2
                user.lemons += 15
            },
            reward: (ctx) => `**250** ${ctx.symbols.tomato} | **15** ${ctx.symbols.lemon} | **2** xp`
        }, {
            id: 'rate5',
            name: 'Rate 5 cards today',
            desc: 'Use rating system to complete this quest. You can rate any card that you own. Rating is your personal, however average rating is calculated too. To see cards that you did not rate yer, use `->cards !rated`. Choose one card and rate it from 1 to 10 with prefix `:`. Example `->rate icy harmony :10`. Do this 5 times. Re-rating cards doesn\'t count.',
            tier: 2,
            can_drop: true,
            min_level: 10,
            actions: ['rate'],
            check: (ctx, user) => user.dailystats.rates >= 5,
            resolve: (ctx, user) => {
                user.exp += 1000
                user.xp += 5
                user.lemons += 30
            },
            reward: (ctx) => `**1000** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **5** xp`
        },
    ],

    getting_started: [],

    upgrade_time: []
}
