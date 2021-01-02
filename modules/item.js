const {XPtoLEVEL}   = require('../utils/tools')
const _             = require('lodash')
const colors        = require('../utils/colors')
const asdate        = require('add-subtract-date')

const {
    getGuildUser,
    isUserOwner,
    addGuildXP,
    getBuilding
} = require('./guild')

const {
    addUserCard,
    removeUserCard,
    formatName
} = require('./card')

const mapUserInventory = (ctx, user) => {
    return user.inventory.map(x => Object.assign({}, ctx.items.find(y => y.id === x.id), x))
}

/**
 * Helper function to enrich the comamnd with user items
 * @param  {Function} callback command handler
 * @return {Promise}
 */
const withUserItems = (callback) => (ctx, user, ...args) => {
    if (user.inventory.length == 0) 
        return ctx.reply(user, 'your inventory is empty', 'red')

    let items = mapUserInventory(ctx, user)

    if(!isNaN(args[0]))
        items = [items[parseInt(args[0]) - 1]]
    else if(args.length > 0) {
        const reg = new RegExp(args.join('*.'), 'gi')
        items = items.filter(x => reg.test(x.id))
    }

    items = items.filter(x => x)

    if(items.length === 0)
        return ctx.reply(user, `found 0 items with ID \`${args.join('')}\``, 'red')

    return callback(ctx, user, items, args)
}

const withItem = (callback) => (ctx, user, ...args) => {
    const intArgs = args.filter(x => !isNaN(x)).map(x => parseInt(x))
    let item
    if(intArgs.length > 0) {
        if(intArgs.length < 2)
            return ctx.reply(user, `please use category **and** item number (e.g. \`2 1\`)
                You can also use \`itemID\` `, 'red')

        const cat = _.uniq(ctx.items.filter(x => x.price >= 0).map(x => x.type))[intArgs[0] - 1]
        item = ctx.items.filter(x => x.price > 0 && x.type === cat)[intArgs[1] - 1]
    } else {
        const reg = new RegExp(args.join('*.'), 'gi')
        item = ctx.items.find(x => x.price > 0 && reg.test(x.id))
    }

    if(!item)
        return ctx.reply(user, `item with ID \`${args.join('')}\` not found or cannot be purchased`, 'red')

    return callback(ctx, user, item, args)
}

const useItem = (ctx, user, item) => uses[item.type](ctx, user, item)
const itemInfo = (ctx, user, item) => infos[item.type](ctx, user, item)
const buyItem = (ctx, user, item) => buys[item.type](ctx, user, item)
const checkItem = (ctx, user, item) => checks[item.type](ctx, user, item)

const uses = {
    blueprint: async (ctx, user, item) => {
        const check = checks.blueprint(ctx, user, item)
        if(check)
            return ctx.reply(user, check, 'red')

        const guild = ctx.guild
        const xp = item.levels[0].price * .1

        guild.buildings.push({ id: item.id, level: 1, health: 100 })
        addGuildXP(ctx, user, xp)
        await ctx.guild.save()

        user.exp -= item.levels[0].price
        pullInventoryItem(user, item.id)
        await user.save()

        ctx.mixpanel.track(
            "Building Build", { 
                distinct_id: user.discord_id,
                building_id: item.id,
                price: item.levels[0].price,
                guild: guild.id,
        })

        return ctx.reply(user, `you successfully built **${item.name}** in **${ctx.msg.channel.guild.name}**
            You have been awarded **${Math.floor(xp)} xp** towards your next rank`)
    },

    claim_ticket: async (ctx, user, item) => {
        const col = item.col? ctx.collections.find(x => x.id === item.col) : _.sample(ctx.collections.filter(x => !x.rarity))
        const card = _.sample(ctx.cards.filter(x => x.col === col.id && x.level === item.level))

        if(!card)
            return ctx.reply(user, `seems like this ticket is not valid anymore`, 'red')

        addUserCard(user, card.id)
        pullInventoryItem(user, item.id)
        await user.save()

        return ctx.reply(user, {
            image: { url: card.url },
            color: colors.blue,
            description: `you got **${formatName(card)}**!`
        })
    },

    recipe: async (ctx, user, item) => {
        const check = checks.recipe(ctx, user, item)
        if(check)
            return ctx.reply(user, check, 'red')

        const userEffect = user.effects.find(x => x.id === item.effectid)
        if(userEffect && userEffect.expires < new Date()) {
            user.heroslots = user.heroslots.filter(x => x != userEffect.id)
            user.effects = user.effects.filter(x => x.id != userEffect.id)
            user.markModified('heroslots')
            user.markModified('effects')
        }

        const effect = ctx.effects.find(x => x.id === item.effectid)
        const eobject = { id: item.effectid }
        if(!effect.passive) { 
            eobject.uses = item.lasts
            eobject.cooldownends = new Date()
        }

        item.cards.map(x => removeUserCard(ctx, user, x))
        pullInventoryItem(user, item.id)
        user.effects.push(eobject)
        await user.save()
        user.markModified('cards')
        await user.save() //double for cards

        ctx.mixpanel.track(
            "Effect Craft", { 
                distinct_id: user.discord_id,
                effect_id: item.id,
                is_passive: effect.passive,
        })

        return ctx.reply(user, {
            image: { url: `${ctx.baseurl}/effects/${effect.id}.gif` },
            color: colors.blue,
            description: `you got **${effect.name}** ${effect.passive? 'passive':'usable'} Effect Card!
                ${effect.passive? `To use this passive effect equip it with \`->hero equip [slot] ${effect.id}\``:
                `Use this effect by typing \`->hero use ${effect.id}\`. Amount of uses is limited to **${item.lasts}**`}`
        })
    }
}

const infos = {
    blueprint: (ctx, user, item) => ({
        description: item.fulldesc,
        fields: item.levels.map((x, i) => ({
            name: `Level ${i + 1}`, 
            value: `Price: **${x.price}** ${ctx.symbols.tomato}
                Maintenance: **${x.maintenance}** ${ctx.symbols.tomato}/day
                Required guild level: **${x.level}**
                > ${x.desc.replace(/{currency}/gi, ctx.symbols.tomato)}`
        }))
    }),

    claim_ticket: (ctx, user, item) => ({
        description: item.fulldesc
    }),

    recipe: (ctx, user, item) => {
        const effect = ctx.effects.find(x => x.id === item.effectid)
        let requires
        if(item.cards) {
            requires = item.cards.map(x => {
                const has = user.cards.some(y => y.id === x)
                return `\`${has? ctx.symbols.accept : ctx.symbols.decline}\` ${formatName(ctx.cards[x])}`
            }).join('\n')

        } else {
            const recipe = item.recipe.reduce((rv, x) => {
                rv[x] = rv[x] + 1 || 1
                return rv
            }, {})
            requires = Object.keys(recipe).map(x => `${x}${ctx.symbols.star} card **x${recipe[x]}**`).join('\n')
        }

        const fields = [
            { name: `Effect`, value: effect.desc },
            { name: `Requires`, value: requires }
        ]

        if(effect.passive) {
            fields.push({ name: `Lasts`, value: `**${item.lasts}** days after being crafted` })
        } else {
            fields.push({ name: `Can be used`, value: `**${item.lasts}** times` })
            fields.push({ name: `Cooldown`, value: `**${effect.cooldown}** hours` })
        }
        
        return ({
            description: item.fulldesc,
            fields,
            image: { url: `${ctx.baseurl}/effects/${effect.id}.${effect.animated? 'gif' : 'jpg'}` },
        })
    }
}

const checks = {
    blueprint: (ctx, user, item) => {
        const guild = ctx.guild
        if(guild.buildings.find(x => x.id === item.id))
            return `this guild already has **${item.name}**`

        if(user.exp < item.levels[0].price)
            return `you need at least **${item.levels[0].price}** ${ctx.symbols.tomato} to build **${item.name} level 1**`

        if(XPtoLEVEL(guild.xp) < item.levels[0].level)
            return `this guild has to be at least level **${item.levels[0].level}** to have **${item.name} level 1**`

        const guilduser = getGuildUser(ctx, user)
        if(!isUserOwner(ctx, user) && guilduser && guilduser.rank < guild.buildperm)
            return `you have to be at least rank **${guild.buildperm}** to build in this guild`
    },

    claim_ticket: (ctx, user, item) => {
        return false
    },

    recipe: (ctx, user, item) => {
        const hub = getBuilding(ctx, 'smithhub')
        if(!hub || hub.level < 3)
            return `you can create effect cards only in guild with **Smithing Hub level 3** or higher`

        if(user.effects.some(x => x.id === item.effectid))
            return `you already have this Effect Card`
    
        const effect = ctx.effects.find(x => x.id === item.effectid)
        if(!item.cards.reduce((val, x) => val && user.cards.some(y => y.id === x), true))
            return `you don't have all required cards in order to use this item.
                Type \`->inv info ${item.id}\` to see the list of required cards`
        
        for(let i = 0; i < item.cards.length; i++) {
            const itemCardID = item.cards[i]
            const userCard = user.cards.find(y => y.id === itemCardID)
            
            if(userCard.fav && userCard.amount === 1) { 
                const card = ctx.cards.find(y => y.id === itemCardID)
                return `the last copy of required card ${formatName(card)} is marked as favourite.
                    Please, use \`->fav remove ${card.name}\` to remove it from favourites first`
            }
        }
    }
}

const buys = {
    blueprint: (ctx, user, item) => user.inventory.push({ id: item.id, time: new Date() }),
    claim_ticket: (ctx, user, item) => user.inventory.push({ id: item.id, time: new Date() }),
    recipe: (ctx, user, item) => {
        const cards = item.recipe.reduce((arr, x) => {
            arr.push(_.sample(ctx.cards.filter(y => y.level === x 
                && !ctx.collections.find(z => z.id === y.col).promo 
                && !arr.includes(y.id))).id)
            return arr
        }, [])
        user.inventory.push({ id: item.id, cards, time: new Date() })
    }
}

const getQuestion = (ctx, user, item) => {
    switch(item.type) {
        case 'blueprint': return `Do you want to build **${item.name}** in **${ctx.msg.channel.guild.name}**?`
        case 'claim_ticket': return `Do you want to use **${item.name}** to get a **${item.level}★** card?`
        case 'recipe': return `Do you want to convert **${item.name}** into an Effect Card? The required cards will be consumed`
    }
}

const pullInventoryItem = (user, itemid) => {
    const el = user.inventory.find(x => x.id === itemid)
    _.pullAt(user.inventory, user.inventory.indexOf(el))
    user.markModified('inventory')
}

module.exports = {
    withUserItems,
    useItem,
    getQuestion,
    itemInfo,
    buyItem,
    withItem,
    checkItem,
}
