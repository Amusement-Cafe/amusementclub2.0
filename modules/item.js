const _             = require('lodash')
const colors        = require('../utils/colors')
const asdate        = require('add-subtract-date')

const {
    XPtoLEVEL,
    numFmt,
} = require('../utils/tools')

const {
    getGuildUser,
    isUserOwner,
    addGuildXP,
    getBuilding,
} = require('./guild')

const {
    addUserCard,
    removeUserCard,
    formatName,
} = require('./card')

const {
    completed
} = require('./collection')

const {
    getUserPlots
} = require('./plot')

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
    let index
    if(!isNaN(args[0])) {
        index = parseInt(args[0]) - 1
        items = [items[index]]
    }
    else if(args.length > 0) {
        const reg = new RegExp(args.join('*.'), 'gi')
        items = items.filter(x => reg.test(x.id))
    }

    items = items.filter(x => x)

    if(items.length === 0)
        return ctx.reply(user, `found 0 items with ID \`${args.join('')}\``, 'red')

    return callback(ctx, user, items, args, index)
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

const useItem = (ctx, user, item, index) => uses[item.type](ctx, user, item, index)
const itemInfo = (ctx, user, item) => infos[item.type](ctx, user, item)
const buyItem = (ctx, user, item) => buys[item.type](ctx, user, item)
const checkItem = (ctx, user, item) => checks[item.type](ctx, user, item)

const uses = {
    blueprint: async (ctx, user, item, index) => {
        const check = await checks.blueprint(ctx, user, item)
        if(check)
            return ctx.reply(user, check, 'red')

        let emptyPlot = await getUserPlots(ctx, false)
        emptyPlot = emptyPlot.filter(x => !x.building.id)[0]

        emptyPlot.next_check = asdate.add(new Date(), 24, 'hours')
        emptyPlot.building.id = item.id
        emptyPlot.building.install_date = new Date()
        emptyPlot.building.last_collected = new Date()
        emptyPlot.building.stored_lemons = 0
        emptyPlot.building.level = 1
        await emptyPlot.save()

        user.lemons -= item.levels[0].price
        pullInventoryItem(user, item.id, index)
        await user.save()

        ctx.mixpanel.track(
            "Building Build", {
                distinct_id: user.discord_id,
                building_id: item.id,
                price: item.levels[0].price,
                guild: ctx.guild.id,
        })

        return ctx.reply(user, `you successfully built **${item.name}** in **${ctx.msg.channel.guild.name}**`)
    },

    claim_ticket: async (ctx, user, item, index) => {
        if(!_.isArray(item.level))
            item.level = [item.level]
        let cards = []
        let resp = `**${user.username}** you got:\n`
        
        item.level.map(x => {
            let col = item.col && item.col !== 'random'? ctx.collections.find(x => x.id === item.col) : _.sample(ctx.collections.filter(x => !x.rarity && !x.promo))
            cards.push(_.sample(ctx.cards.filter(y => y.col === col.id && y.level === x)))
        })

        if(cards.length === 0)
            return ctx.reply(user, `seems like this ticket is not valid anymore`, 'red')

        cards.map(x => {
            const count = addUserCard(user, x.id)
            if (count > 1)
                resp += `**${formatName(x)}** #${count}\n`
            else
                resp += `**new** **${formatName(x)}**\n`
        })
        resp += `from using **${item.name}**`

        pullInventoryItem(user, item.id, index)
        await user.save()

        user.markModified('cards')
        user.lastcard = cards[0].id
        await user.save()

        const pages = cards.map(x => x.url)
        return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
            pages,
            buttons: ['back', 'forward'],
            switchPage: (data) => data.embed.image.url = data.pages[data.pagenum],
            embed: {
                color: colors.green,
                description: resp,
                image: { url: '' }
            }
        })
    },

    recipe: async (ctx, user, item, index) => {
        let eobject, desc
        const check = checks.recipe(ctx, user, item)
        if(check)
            return ctx.reply(user, check, 'red')

        let userEffect = user.effects.find(x => x.id === item.effectid)
        if(userEffect && userEffect.expires < new Date()) {
            user.heroslots = user.heroslots.filter(x => x != userEffect.id)
            user.effects = user.effects.filter(x => x.id != userEffect.id)
            user.markModified('heroslots')
            user.markModified('effects')
            userEffect = false
        }

        const effect = ctx.effects.find(x => x.id === item.effectid)
        if (userEffect) {
            eobject = userEffect
            if(!effect.passive) {
                eobject.uses += item.lasts
            } else {
                desc = `you already own this effect and it has never been equipped! You can only extend effects that have been equipped.`
                if (!userEffect.expires)
                    return ctx.reply(user, desc, 'red')
                eobject.expires = asdate.add(userEffect.expires, item.lasts, 'days')
            }
            user.effects = user.effects.filter(x => x.id != userEffect.id)
            desc = `you got **${effect.name}** ${effect.passive? 'passive':'usable'} Effect Card!
                ${effect.passive? `The countdown timer on this effect has been extended. Find it in \`${ctx.prefix}hero slots\``:
                `You have extended the number of uses for this effect. Your new usage limit is **${eobject.uses}**`}`
        } else {
            eobject = { id: item.effectid }
            if(!effect.passive) {
                eobject.uses = item.lasts
                eobject.cooldownends = new Date()
            }
            desc = `you got **${effect.name}** ${effect.passive? 'passive':'usable'} Effect Card!
                ${effect.passive? `To use this passive effect equip it with \`->hero equip [slot] ${effect.id}\``:
                `Use this effect by typing \`->hero use ${effect.id}\`. Amount of uses is limited to **${item.lasts}**`}`
        }

        ctx.mixpanel.track(
            "Effect Craft", { 
                distinct_id: user.discord_id,
                effect_id: item.id,
                is_passive: effect.passive,
        })

        item.cards.map(x => {
            removeUserCard(ctx, user, x)
            completed(ctx, user, ctx.cards[x])
        })
        pullInventoryItem(user, item.id, index)
        user.effects.push(eobject)
        await user.save()
        user.markModified('cards')
        await user.save() //double for cards

        return ctx.reply(user, {
            image: { url: `${ctx.baseurl}/effects/${effect.id}.gif` },
            description: desc
        }, 'blue')


    }
}

const infos = {
    blueprint: (ctx, user, item) => {
        let embed = {
            description: item.fulldesc,
            fields: [{
                name: `Blueprint Price`,
                value: `Price: **${item.price}**${ctx.symbols.lemon}`
            }]
        }
        item.levels.map((x, i) => (embed.fields.push({
            name: `Level ${i + 1}`,
            value: `Price: **${x.price}** ${ctx.symbols.lemon}
                Level Requirement: **${x.level}**
                > ${x.desc.replace(/{currency}/gi, ctx.symbols.lemon)}`
        })))
        return embed
    },

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
            fields.push({ name: `Lasts`, value: `**${numFmt(item.lasts)}** days after being crafted` })
        } else {
            fields.push({ name: `Can be used`, value: `**${numFmt(item.lasts)}** times` })
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
    blueprint: async (ctx, user, item) => {
        const userPlots = await getUserPlots(ctx, false)
        const userLevel = XPtoLEVEL(user.xp)

        if (userLevel < item.levels[0].level)
            return `you need to be level ${item.levels[0].level} to build this building! See your level in \`${ctx.guild.prefix}profile\``

        if (!userPlots.find(x => x.building.id === 'castle') && item.id !== 'castle')
            return `you need to build a castle here first before you can place any other buildings!`

        if(userPlots.find(x => x.building.id === item.id))
            return `you already have a **${item.name}** in this guild!`

        if(user.lemons < item.levels[0].price)
            return `you need at least **${item.levels[0].price}** ${ctx.symbols.lemon} to build **${item.name} level 1**`

        if(!userPlots.find(x => !x.building.id))
            return `you need to have an empty plot to build ${item.name}!\nBuy one with \`${ctx.guild.prefix}plot buy\``
    },

    claim_ticket: (ctx, user, item) => {
        return false
    },

    recipe: (ctx, user, item) => {
        const now = new Date()

        //Keeping this here in case we for some reason need to revert to not allowing stacking effects
        // if(user.effects.some(x => x.id === item.effectid && (x.expires || x.expires > now)))
        //     return `you already have this Effect Card`
    
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
    claim_ticket: (ctx, user, item) => {
        let col
        if(!_.isArray(item.level))
            item.level = [item.level]

        if(item.col !== "random")
            col = _.sample(ctx.collections.filter(x => !x.rarity && !x.promo))

        let uItem = { id: item.id, time: new Date() }
        if (col)
            uItem.col = col.id
        
        user.inventory.push(uItem)
    },
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
        case 'claim_ticket': return `Do you want to use **${item.name}** to get **${_.isArray(item.level)? `${item.level.length} ${item.level[0]}`: `1 ${item.level}`} ★** card(s)?`
        case 'recipe': return `Do you want to convert **${item.name}** into an Effect Card? The required cards will be consumed`
    }
}

const pullInventoryItem = (user, itemid, index) => {
    if (index) {
        _.pullAt(user.inventory, index)
    } else {
        const el = user.inventory.find(x => x.id === itemid)
        _.pullAt(user.inventory, user.inventory.indexOf(el))
    }
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
