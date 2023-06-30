module.exports = {
    daily: [
        {
            id: 'claim4',
            name: 'Claim 4 cards today',
            desc: 'Claim cards using the `/claim cards` command. Example: `/claim cards count: 4`',
            tier: 1,
            can_drop: true,
            min_level: 0,
            actions: ['claim cards'],
            check: (ctx, user, stats) => stats.totalregclaims >= 4,
            resolve: (ctx, user, stats) => {
                user.exp += 750
                user.xp += 2
                user.lemons += 15
                stats.tomatoin += 750
                stats.lemonin += 15
            },
            reward: (ctx) => `**750** ${ctx.symbols.tomato} | **15** ${ctx.symbols.lemon} | **2** xp`
        }, {
            id: 'claim8',
            name: 'Claim 8 cards today',
            desc: 'Claim cards using the `/claim cards` command. Example: `/claim cards count:8`',
            tier: 2,
            can_drop: true,
            min_level: 10,
            actions: ['claim', 'cl'],
            check: (ctx, user, stats) => stats.totalregclaims >= 8,
            resolve: (ctx, user, stats) => {
                user.exp += 1500
                user.xp += 5
                user.lemons += 30
                stats.tomatoin += 1500
                stats.lemonin += 30
            },
            reward: (ctx) => `**1,500** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **5** xp`
        }, {
            id: 'bid2',
            name: 'Bid on 2 auctions today',
            desc: 'Use auction to complete this quest. Find an auction you like using `->auc`. Bid successfully on one of the auctions using auction ID and price with prefix `:`. Example: `->auc bid xhgr :100`. Try bidding higher if you get instantly outbid!',
            tier: 1,
            can_drop: true,
            min_level: 15,
            actions: ['auc', 'auction'],
            check: (ctx, user, stats) => stats.aucbid >= 2,
            resolve: (ctx, user, stats) => {
                user.exp += 1250
                user.xp += 2
                user.lemons += 15
                stats.tomatoin += 1250
                stats.lemonin += 15
            },
            reward: (ctx) => `**1,250** ${ctx.symbols.tomato} | **15** ${ctx.symbols.lemon} | **2** xp`
        }, {
            id: 'bid5',
            name: 'Bid on 4 auctions today',
            desc: 'Use auction to complete this quest. Find an auction you like using `->auc`. Bid successfully on one of the auctions using auction ID and price with prefix `:`. Example: `->auc bid xhgr :100`. Try bidding higher if you get instantly outbid!',
            tier: 2,
            can_drop: true,
            min_level: 50,
            actions: ['auc', 'auction'],
            check: (ctx, user, stats) => stats.aucbid >= 4,
            resolve: (ctx, user, stats) => {
                user.exp += 2000
                user.xp += 8
                user.lemons += 30
                stats.tomatoin += 2000
                stats.lemonin += 30
            },
            reward: (ctx) => `**2,000** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **8** xp`
        }, {
            id: 'forge1',
            name: 'Forge 1-star card',
            desc: 'Use forge to complete this quest. Forge allows you to merge two cards and get one. See list of your cards using `->cards` and find two 1-star cards that you don\'t need/like and then forge them together. Keep in mind that you can only forge cards with the same amount of stars. Example: `->forge card_query_1:eat them all card_query_2:tsundere side`. If you have multiples of some card, you can also use `->forge -1 -multi` and let system choose cards for you (only multiples will be chosen).',
            tier: 1,
            can_drop: true,
            min_level: 0,
            building: 'smithhub1',
            actions: ['forge'],
            check: (ctx, user, stats) => stats.forge1 >= 1,
            resolve: (ctx, user, stats) => {
                user.exp += 600
                user.xp += 1
                user.lemons += 15
                stats.tomatoin += 600
                stats.lemonin += 15
            },
            reward: (ctx) => `**600** ${ctx.symbols.tomato} | **15** ${ctx.symbols.lemon} | **1** xp`
        }, {
            id: 'forge2',
            name: 'Forge 2-star card',
            desc: 'Use forge to complete this quest. Forge allows you to merge two cards and get one. See list of your cards using `->cards` and find two 2-star cards that you don\'t need/like and then forge them together. Keep in mind that you can only forge cards with the same amount of stars. Example: `->forge card_query_1:eat them all card_query_2:tsundere side`. If you have multiples of some card, you can also use `->forge -2 -multi` and let system choose cards for you (only multiples will be chosen).',
            tier: 1,
            can_drop: true,
            min_level: 5,
            building: 'smithhub1',
            actions: ['forge'],
            check: (ctx, user, stats) => stats.forge2 >= 1,
            resolve: (ctx, user, stats) => {
                user.exp += 900
                user.vials += 25
                user.xp += 2
                user.lemons += 15
                stats.tomatoin += 900
                stats.lemonin += 15
                stats.vialin += 25
            },
            reward: (ctx) => `**900** ${ctx.symbols.tomato} | **15** ${ctx.symbols.lemon} | **25** ${ctx.symbols.vial} | **2** xp`
        }, {
            id: 'forge3',
            name: 'Forge 3-star card',
            desc: 'Use forge to complete this quest. Forge allows you to merge two cards and get one. See list of your cards using `->cards` and find two 3-star cards that you don\'t need/like and then forge them together. Keep in mind that you can only forge cards with the same amount of stars. Example: `->forge card_query_1:eat them all card_query_2:tsundere side`. If you have multiples of some card, you can also use `->forge -3 -multi` and let system choose cards for you (only multiples will be chosen)',
            tier: 2,
            can_drop: true,
            min_level: 15,
            building: 'smithhub1',
            actions: ['forge'],
            check: (ctx, user, stats) => stats.forge3 >= 1,
            resolve: (ctx, user, stats) => {
                user.exp += 1200
                user.vials += 40
                user.xp += 5
                user.lemons += 30
                stats.tomatoin += 1200
                stats.lemonin += 30
                stats.vialin += 40
            },
            reward: (ctx) => `**1,200** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **40** ${ctx.symbols.vial} | **5** xp`
        }, {
            id: 'tag2',
            name: 'Tag 2 cards',
            desc: '',
            tier: 1,
            can_drop: false,
            min_level: 15,
            actions: ['tag'],
            check: (ctx, user, stats) => stats.tags >= 2,
            resolve: (ctx, user, stats) => {
                user.exp += 400
                user.xp += 2
                stats.tomatoin += 400
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
            check: (ctx, user, stats) => stats.tags >= 4,
            resolve: (ctx, user, stats) => {
                user.exp += 800
                user.xp += 4
                stats.tomatoin += 800
            },
            reward: (ctx) => `**800** ${ctx.symbols.tomato} | **4** xp`
        }, {
            id: 'liq2',
            name: 'Liquefy 2 cards',
            desc: 'Use liquefy to complete this quest. Liquefy allows you to convert cards into vials that are used to draw cards that you want. See list of your cards using `->cards` and find a card that you don\'t need/like and then liquefy it. Example: `->liquefy one card_query:eat them all`. Do this 2 times for different cards.',
            tier: 2,
            can_drop: true,
            min_level: 10,
            building: 'smithhub2',
            actions: ['liq', 'liquify'],
            check: (ctx, user, stats) => stats.liquefy >= 2,
            resolve: (ctx, user, stats) => {
                user.exp += 500
                user.xp += 3
                user.lemons += 30
                stats.tomatoin += 500
                stats.lemonin += 30
            },
            reward: (ctx) => `**500** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **3** xp`
        }, {
            id: 'liq4',
            name: 'Liquefy 4 cards',
            desc: 'Use liquefy to complete this quest. Liquefy allows you to convert cards into vials that are used to draw cards that you want. See list of your cards using `->cards` and find a card that you don\'t need/like and then liquefy it. Example: `->liquefy one card_query:eat them all`. Do this 4 times for different cards.',
            tier: 2,
            can_drop: true,
            min_level: 35,
            building: 'smithhub2',
            actions: ['draw'],
            check: (ctx, user, stats) => stats.liquefy >= 4,
            resolve: (ctx, user, stats) => {
                user.exp += 500
                user.xp += 6
                user.lemons += 30
                stats.tomatoin += 500
                stats.lemonin += 30
            },
            reward: (ctx) => `**500** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **6** xp`
        }, {
            id: 'draw2',
            name: 'Draw 2 cards',
            desc: 'Use draw to complete this quest. With draw you can get any card that you want as long as you know the name. Search for a card using `->cards global:true` (e.g. `->cards global:true card_query:tohru` or `->cards global:true card_query:-touhou` or `->cards global:true card_query:#keqing`) then draw any card from the list. Example: `->draw thundering might`. Do this 2 times.',
            tier: 2,
            can_drop: true,
            min_level: 20,
            building: 'smithhub2',
            actions: ['draw'],
            check: (ctx, user, stats) => stats.draw >= 2,
            resolve: (ctx, user, stats) => {
                user.exp += 500
                user.vials += Math.floor(stats.vialout * 0.75)
                user.xp += 3
                user.lemons += 30
                stats.tomatoin += 500
                stats.lemonin += 30
                stats.vialin += Math.floor(stats.vialout * 0.75)
            },
            reward: (ctx) => `**500** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **75%** ${ctx.symbols.vial} cost | **3** xp`
        }, {
            id: 'draw4',
            name: 'Draw 4 cards',
            desc: 'Use draw to complete this quest. With draw you can get any card that you want as long as you know the name. Search for a card using `->cards global:true` (e.g. `->cards global:true card_query:tohru` or `->cards global:true card_query:-touhou` or `->cards global:true card_query:#keqing`) then draw any card from the list. Example: `->draw thundering might`. Do this 4 times.',
            tier: 2,
            can_drop: true,
            min_level: 40,
            building: 'smithhub2',
            actions: ['draw'],
            check: (ctx, user, stats) => stats.draw >= 4,
            resolve: (ctx, user, stats) => {
                user.exp += 500
                user.vials += Math.floor(stats.vialout * 0.8)
                user.xp += 6
                user.lemons += 30
                stats.tomatoin += 500
                stats.lemonin += 30
                stats.vialin += Math.floor(stats.vialout * 0.8)
            },
            reward: (ctx) => `**500** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **80%** ${ctx.symbols.vial} cost | **6** xp`
        }, {
            id: 'draw1star',
            name: 'Draw a 1 star card',
            desc: 'Use draw to complete this quest. With draw you can get any card that you want as long as you know the name. This quest requires specific rarity of card (1). Search for a card using `->cards global:true` (e.g. `->cards global:true card_query:tohru` or `->cards global:true card_query:-touhou` or `->cards global:true card_query:#keqing`) then draw any card from the list. Example: `->draw purple gold`.',
            tier: 1,
            can_drop: true,
            min_level: 5,
            building: 'smithhub2',
            actions: ['draw'],
            check: (ctx, user, stats) => stats.draw1 >= 1,
            resolve: (ctx, user, stats) => {
                user.exp += 250
                user.vials += 40
                user.xp += 2
                user.lemons += 15
                stats.tomatoin += 250
                stats.lemonin += 15
                stats.vialin += 40
            },
            reward: (ctx) => `**250** ${ctx.symbols.tomato} | **15** ${ctx.symbols.lemon} | **40** ${ctx.symbols.vial} | **3** xp`
        }, {
            id: 'draw2star',
            name: 'Draw a 2 star card',
            desc: 'Use draw to complete this quest. With draw you can get any card that you want as long as you know the name. This quest requires specific rarity of card (2). Search for a card using `->cards global:true` (e.g. `->cards global:true card_query:tohru` or `->cards global:true card_query:-touhou` or `->cards global:true card_query:#keqing`) then draw any card from the list. Example: `->draw sacrificial sword`.',
            tier: 1,
            can_drop: true,
            min_level: 15,
            building: 'smithhub2',
            actions: ['draw'],
            check: (ctx, user, stats) => stats.draw2 >= 1,
            resolve: (ctx, user, stats) => {
                user.exp += 250
                user.vials += 80
                user.xp += 3
                user.lemons += 15
                stats.tomatoin += 250
                stats.vialin += 80
                stats.lemonin += 15
            },
            reward: (ctx) => `**250** ${ctx.symbols.tomato} | **15** ${ctx.symbols.lemon} | **80** ${ctx.symbols.vial} | **3** xp`
        }, {
            id: 'draw3star',
            name: 'Draw a 3 star card',
            desc: 'Use draw to complete this quest. With draw you can get any card that you want as long as you know the name. This quest requires specific rarity of card (3). Search for a card using `->cards global:true` (e.g. `->cards global:true card_query:tohru` or `->cards global:true card_query:-touhou` or `->cards global:true card_query:#keqing`) then draw any card from the list. Example: `->draw icy harmony `.',
            tier: 2,
            can_drop: true,
            min_level: 25,
            building: 'smithhub2',
            actions: ['draw'],
            check: (ctx, user, stats) => stats.draw3 >= 1,
            resolve: (ctx, user, stats) => {
                user.exp += 500
                user.vials += 250
                user.xp += 4
                user.lemons += 30
                stats.tomatoin += 500
                stats.vialin += 250
                stats.lemonin += 30
            },
            reward: (ctx) => `**500** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **250** ${ctx.symbols.vial} | **4** xp`
        }, {
            id: 'rate2',
            name: 'Rate 2 cards today',
            desc: 'Use rating system to complete this quest. You can rate any card that you own. Rating is your personal, however average rating is calculated too. To see cards that you did not rate yer, use `->cards !rated`. Choose one card and rate it from 1 to 10 with prefix `:`. Example `->rate icy harmony :10`. Do this 2 times. Re-rating cards doesn\'t count.',
            tier: 1,
            can_drop: true,
            min_level: 0,
            actions: ['rate'],
            check: (ctx, user, stats) => stats.rates >= 2,
            resolve: (ctx, user, stats) => {
                user.exp += 250
                user.xp += 2
                user.lemons += 15
                stats.tomatoin += 250
                stats.lemonin += 15
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
            check: (ctx, user, stats) => stats.rates >= 5,
            resolve: (ctx, user, stats) => {
                user.exp += 500
                user.xp += 5
                user.lemons += 30
                stats.tomatoin += 500
                stats.lemonin += 30
            },
            reward: (ctx) => `**500** ${ctx.symbols.tomato} | **30** ${ctx.symbols.lemon} | **5** xp`
        },
    ],

    weekly: [
        {
            id: 'claim28',
            name: 'Claim 28 Cards',
            desc: 'Claim cards using the `/claim cards` command. As this is a **weekly** quest, you have 7 days to complete it. Example: `/claim cards count:10`',
            tier: 3,
            can_drop: true,
            min_level: 0,
            actions: ['claim cards'],
            progress: (ctx, user, stats, extra) => `[${extra.totalregclaims}/28]`,
            check: (ctx, user, stats, extra) => extra.totalregclaims >= 28,
            resolve: (ctx, user, stats) => {
                user.exp += 750
                stats.tomatoin += 750
                user.lemons += 60
                stats.lemonin += 60
            },
            reward: (ctx) => `**750** ${ctx.symbols.tomato} | **60** ${ctx.symbols.lemon}`
        },
        {
            id: 'claim56',
            name: 'Claim 56 cards',
            desc: 'Claim cards using the `/claim cards` command. As this is a **weekly** quest, you have 7 days to complete it. Example: `/claim cards count:10`',
            tier: 4,
            can_drop: true,
            min_level: 20,
            actions: ['claim cards'],
            progress: (ctx, user, stats, extra) => `[${extra.totalregclaims}/56]`,
            check: (ctx, user, stats, extra) => extra.totalregclaims >= 56,
            resolve: (ctx, user, stats) => {
                user.exp += 1000
                stats.tomatoin += 1000
                user.lemons += 120
                stats.lemonin += 120
            },
            reward: (ctx) => `**1,000** ${ctx.symbols.tomato} | **120** ${ctx.symbols.lemon}`
        },
        {
            id: 'complete4',
            name: 'Complete 4 quests',
            desc: 'Complete quests during the week, any quest type counts toward your completion. Check your progress with the `stats` command. As this is a **weekly** quest, you have 7 days to complete it.',
            tier: 3,
            can_drop: true,
            min_level: 0,
            actions: ['quest list'],
            progress: (ctx, user, stats, extra) => `[${[extra.t1quests, extra.t2quests, extra.t3quests, extra.t4quests, extra.t5quests, extra.t6quests].filter(x => !isNaN(x)).reduce((a, b) => a + b, 0) || 0}/4]`,
            check: (ctx, user, stats, extra) => ([extra.t1quests, extra.t2quests, extra.t3quests, extra.t4quests, extra.t5quests, extra.t6quests].filter(x => !isNaN(x)).reduce((a, b) => a + b, 0))  >= 4,
            resolve: (ctx, user, stats) => {
                user.exp += 750
                stats.tomatoin += 750
                user.lemons += 60
                stats.lemonin += 60
            },
            reward: (ctx) => `**750** ${ctx.symbols.tomato} | **60** ${ctx.symbols.lemon}`
        },
        {
            id: 'complete7',
            name: 'Complete 7 quests',
            desc: 'Complete quests during the week, any quest type counts toward your completion. Check your progress with the `stats` command. As this is a **weekly** quest, you have 7 days to complete it.',
            tier: 4,
            can_drop: true,
            min_level: 0,
            actions: ['quest list'],
            progress: (ctx, user, stats, extra) => `[${[extra.t1quests, extra.t2quests, extra.t3quests, extra.t4quests, extra.t5quests, extra.t6quests].filter(x => !isNaN(x)).reduce((a, b) => a + b, 0)  || 0}/7]`,
            check: (ctx, user, stats, extra) => ([extra.t1quests, extra.t2quests, extra.t3quests, extra.t4quests, extra.t5quests, extra.t6quests].filter(x => !isNaN(x)).reduce((a, b) => a + b, 0))  >= 7,
            resolve: (ctx, user, stats) => {
                user.exp += 1000
                stats.tomatoin += 1000
                user.lemons += 120
                stats.lemonin += 120
            },
            reward: (ctx) => `**1,000** ${ctx.symbols.tomato} | **120** ${ctx.symbols.lemon}`
        },
        {
            id: 'draw10',
            name: 'Draw 10 cards',
            desc: 'Use draw to complete this quest. With draw you can get any card that you want as long as you know the name. Search for a card using `->cards global:true` (e.g. `->cards global:true card_query:tohru` or `->cards global:true card_query:-touhou` or `->cards global:true card_query:#keqing`) then draw any card from the list. Example: `->draw thundering might`. Do this 10 times. As this is a **weekly** quest, you have 7 days to complete it.',
            tier: 3,
            can_drop: true,
            min_level: 0,
            actions: ['draw'],
            progress: (ctx, user, stats, extra) => `[${extra.draw}/10]`,
            check: (ctx, user, stats, extra) => extra.draw >= 10,
            resolve: (ctx, user, stats) => {
                user.exp += 750
                stats.tomatoin += 750
                user.lemons += 60
                stats.lemonin += 60
            },
            reward: (ctx) => `**750** ${ctx.symbols.tomato} | **60** ${ctx.symbols.lemon}`
        },
        {
            id: 'draw12',
            name: 'Draw 12 cards',
            desc: 'Use draw to complete this quest. With draw you can get any card that you want as long as you know the name. Search for a card using `->cards global:true` (e.g. `->cards global:true card_query:tohru` or `->cards global:true card_query:-touhou` or `->cards global:true card_query:#keqing`) then draw any card from the list. Example: `->draw thundering might`. Do this 12 times. As this is a **weekly** quest, you have 7 days to complete it.',
            tier: 4,
            can_drop: true,
            min_level: 0,
            actions: [],
            progress: (ctx, user, stats, extra) => `[${extra.draw}/12]`,
            check: (ctx, user, stats, extra) => extra.draw >= 12,
            resolve: (ctx, user, stats) => {
                user.exp += 1000
                stats.tomatoin += 1000
                user.lemons += 120
                stats.lemonin += 120
            },
            reward: (ctx) => `**1,000** ${ctx.symbols.tomato} | **120** ${ctx.symbols.lemon}`
        },
        {
            id: 'bid12',
            name: 'Bid on 12 auctions',
            desc: 'Use auction to complete this quest. Find an auction you like using `->auction list`. Example: `->auction bid`. Try bidding higher if you get instantly outbid! As this is a **weekly** quest, you have 7 days to complete it.',
            tier: 3,
            can_drop: true,
            min_level: 0,
            actions: [],
            progress: (ctx, user, stats, extra) => `[${extra.aucbid}/12]`,
            check: (ctx, user, stats, extra) => extra.aucbid >= 12,
            resolve: (ctx, user, stats) => {
                user.exp += 750
                stats.tomatoin += 750
                user.lemons += 60
                stats.lemonin += 60
            },
            reward: (ctx) => `**750** ${ctx.symbols.tomato} | **60** ${ctx.symbols.lemon}`
        },
        {
            id: 'bid18',
            name: 'Bid on 18 auctions',
            desc: 'Use auction to complete this quest. Find an auction you like using `->auction list`. Example: `->auction bid`. Try bidding higher if you get instantly outbid! As this is a **weekly** quest, you have 7 days to complete it.',
            tier: 4,
            can_drop: true,
            min_level: 0,
            actions: [],
            progress: (ctx, user, stats, extra) => `[${extra.aucbid}/18]`,
            check: (ctx, user, stats, extra) => extra.aucbid >= 18,
            resolve: (ctx, user, stats) => {
                user.exp += 1000
                stats.tomatoin += 1000
                user.lemons += 120
                stats.lemonin += 120
            },
            reward: (ctx) => `**1,000** ${ctx.symbols.tomato} | **120** ${ctx.symbols.lemon}`
        }
    ],

    monthly: [
        {
            id: 'claim120',
            name: 'Claim 120 Cards',
            desc: 'Claim cards using the `/claim cards` command. As this is a **monthly** quest, you have 30 days to complete it. Example: `/claim cards count:10`',
            tier: 5,
            can_drop: true,
            min_level: 0,
            actions: ['claim cards'],
            progress: (ctx, user, stats, extra) => `[${extra.totalregclaims}/120]`,
            check: (ctx, user, stats, extra) => extra.totalregclaims >= 120,
            resolve: (ctx, user, stats) => {
                user.exp += 3000
                stats.tomatoin += 3000
                user.lemons += 240
                stats.lemonin += 240
            },
            reward: (ctx) => `**3,000** ${ctx.symbols.tomato} | **240** ${ctx.symbols.lemon}`
        },
        {
            id: 'claim240',
            name: 'Claim 240 cards',
            desc: 'Claim cards using the `/claim cards` command. As this is a **monthly** quest, you have 30 days to complete it. Example: `/claim cards count:10`',
            tier: 6,
            can_drop: true,
            min_level: 10,
            actions: ['claim cards'],
            progress: (ctx, user, stats, extra) => `[${extra.totalregclaims}/240]`,
            check: (ctx, user, stats, extra) => extra.totalregclaims >= 240,
            resolve: (ctx, user, stats) => {
                user.exp += 6000
                stats.tomatoin += 6000
                user.lemons += 480
                stats.lemonin += 480
            },
            reward: (ctx) => `**6,000** ${ctx.symbols.tomato} | **480** ${ctx.symbols.lemon}`
        },
        {
            id: 'complete15',
            name: 'Complete 15 quests',
            desc: 'Complete quests during the month, any quest type counts toward your completion. Check your progress with the `stats` command. As this is a **monthly** quest, you have 30 days to complete it.',
            tier: 5,
            can_drop: true,
            min_level: 0,
            actions: ['stats'],
            progress: (ctx, user, stats, extra) => `[${[extra.t1quests, extra.t2quests, extra.t3quests, extra.t4quests, extra.t5quests, extra.t6quests].filter(x => !isNaN(x)).reduce((a, b) => a + b, 0) }/15]`,
            check: (ctx, user, stats, extra) => [extra.t1quests, extra.t2quests, extra.t3quests, extra.t4quests, extra.t5quests, extra.t6quests].filter(x => !isNaN(x)).reduce((a, b) => a + b, 0)  >= 15,
            resolve: (ctx, user, stats) => {
                user.exp += 1250
                stats.tomatoin += 1250
                user.lemons += 240
                stats.lemonin += 240
            },
            reward: (ctx) => `**1,250** ${ctx.symbols.tomato} | **240** ${ctx.symbols.lemon}`
        },
        {
            id: 'complete20',
            name: 'Complete 20 quests',
            desc: 'Complete quests during the month, any quest type counts toward your completion. Check your progress with the `stats` command. As this is a **monthly** quest, you have 30 days to complete it.',
            tier: 6,
            can_drop: true,
            min_level: 0,
            actions: ['stats'],
            progress: (ctx, user, stats, extra) => `[${[extra.t1quests, extra.t2quests, extra.t3quests, extra.t4quests, extra.t5quests, extra.t6quests].filter(x => !isNaN(x)).reduce((a, b) => a + b, 0) }/20]`,
            check: (ctx, user, stats, extra) => ([extra.t1quests, extra.t2quests, extra.t3quests, extra.t4quests, extra.t5quests, extra.t6quests].filter(x => !isNaN(x)).reduce((a, b) => a + b, 0))  >= 20,
            resolve: (ctx, user, stats) => {
                user.exp += 1500
                stats.tomatoin += 1500
                user.lemons += 480
                stats.lemonin += 480
            },
            reward: (ctx) => `**1,500** ${ctx.symbols.tomato} | **480** ${ctx.symbols.lemon}`
        },
        {
            id: 'bid30',
            name: 'Bid on 30 auctions',
            desc: 'Use auction to complete this quest. Find an auction you like using `->auction list`. Example: `->auction bid`. Try bidding higher if you get instantly outbid! As this is a **monthly** quest, you have 30 days to complete it.',
            tier: 5,
            can_drop: true,
            min_level: 0,
            actions: ['auction bid'],
            progress: (ctx, user, stats, extra) => `[${extra.aucbid}/30]`,
            check: (ctx, user, stats, extra) => extra.aucbid >= 30,
            resolve: (ctx, user, stats) => {
                user.exp += 7500
                stats.tomatoin += 7500
                user.lemons += 240
                stats.lemonin += 240
            },
            reward: (ctx) => `**7,500** ${ctx.symbols.tomato} | **240** ${ctx.symbols.lemon}`
        },
        {
            id: 'bid45',
            name: 'Bid on 45 auctions',
            desc: 'Use auction to complete this quest. Find an auction you like using `->auction list`. Example: `->auction bid`. Try bidding higher if you get instantly outbid! As this is a **monthly** quest, you have 30 days to complete it.',
            tier: 6,
            can_drop: true,
            min_level: 0,
            actions: ['auction bid'],
            progress: (ctx, user, stats, extra) => `[${extra.aucbid}/45]`,
            check: (ctx, user, stats, extra) => extra.aucbid >= 45,
            resolve: (ctx, user, stats) => {
                user.exp += 10000
                stats.tomatoin += 10000
                user.lemons += 480
                stats.lemonin += 480
            },
            reward: (ctx) => `**10,000** ${ctx.symbols.tomato} | **480** ${ctx.symbols.lemon}`
        }
    ],

    getting_started: [],

    upgrade_time: []
}
