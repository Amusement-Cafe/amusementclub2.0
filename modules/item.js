const _             = require('lodash')
const colors        = require('../utils/colors')
const asdate        = require('add-subtract-date')
const UserSlot      = require("../collections/userSlot")
const msToTime      = require('pretty-ms')



const {
    XPtoLEVEL,
    numFmt,
} = require('../utils/tools')

const {
    formatName,
    mapUserCards,
    filter, bestMatch,
} = require('./card')

const {
    completed,
} = require('./collection')

const {
    getUserPlots,
} = require('./plot')

const { 
    addUserCards,
    removeUserCards,
    findUserCards,
    getUserCards,
    fetchOnly,
} = require('./user')

const {
    getStats,
    saveAndCheck
} = require("./userstats");


const mapUserInventory = (ctx, user) => {
    return user.inventory.map(x => Object.assign({}, ctx.items.find(y => y.id === x.id), x))
}

/**
 * Helper function to enrich the comamnd with user items
 * @param  {Function} callback command handler
 * @return {Promise}
 */
const withUserItems = (callback) => (ctx, user, args) => {
    if (user.inventory.length == 0) 
        return ctx.reply(user, `your inventory is empty.
        You can obtain inventory items in the \`${ctx.prefix}store\`.
        If you are looking for your cards, use \`${ctx.prefix}cards\` instead.
        For more information see \`${ctx.prefix}help help_menu:inventory\``, 'red')

    let items = mapUserInventory(ctx, user)
    let index
    if(!isNaN(args.invItem)) {
        index = parseInt(args.invItem) - 1
        items = [items[index]]
    } else {
        const reg = new RegExp(args.invItem, 'gi')
        items = items.filter(x => reg.test(x.id))
    }

    items = items.filter(x => x)

    if(items.length === 0)
        return ctx.reply(user, `found 0 items with ID \`${args.invItem}\``, 'red')

    return callback(ctx, user, items, args, index)
}

const withItem = (callback) => (ctx, user, args) => {
    const intArgs = args.itemID.split(' ').filter(x => !isNaN(x)).map(y => parseInt(y))
    let item
    if(intArgs.length > 0) {
        if(intArgs.length < 2)
            return ctx.reply(user, `please use category **and** item number (e.g. \`2 1\`)
                You can also use \`itemID\` `, 'red')

        const cat = _.uniq(ctx.items.filter(x => x.price >= 0).map(x => x.type))[intArgs[0] - 1]
        item = ctx.items.filter(x => x.price > 0 && x.type === cat)[intArgs[1] - 1]
    } else {
        const reg = new RegExp(args.itemID, 'gi')
        item = ctx.items.find(x => x.price > 0 && reg.test(x.id))
    }

    if(!item)
        return ctx.reply(user, `item with ID \`${args.itemID}\` not found or cannot be purchased`, 'red')

    return callback(ctx, user, item, args)
}

const useItem = (ctx, user, item, index, args) => uses[item.type](ctx, user, item, index, args)
const itemInfo = (ctx, user, item) => infos[item.type](ctx, user, item)
const buyItem = (ctx, user, item) => buys[item.type](ctx, user, item)
const checkItem = (ctx, user, item, args) => checks[item.type](ctx, user, item, args)

const uses = {
    blueprint: async (ctx, user, item, index) => {
        const check = await checks.blueprint(ctx, user, item)
        if(check)
            return ctx.reply(user, check, 'red')

        let stats = await getStats(ctx, user, user.lastdaily)
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
        stats.lemonout += item.levels[0].price
        await user.save()
        await saveAndCheck(ctx, user, stats)

        ctx.mixpanel.track(
            "Building Build", {
                distinct_id: user.discord_id,
                building_id: item.id,
                price: item.levels[0].price,
                guild: ctx.guild.id,
        })

        return ctx.reply(user, `you successfully built **${item.name}** in **${ctx.interaction.channel.guild.name}**`, 'green', true)
    },

    claim_ticket: async (ctx, user, item, index) => {
        if(!_.isArray(item.level))
            item.level = [item.level]
        let cards = []
        let resp = `**${user.username}** you got:\n`
        const existingCards = await getUserCards(ctx, user)


        item.level.map(x => {
            let col = item.col && item.col !== 'random'? ctx.collections.find(x => x.id === item.col) : _.sample(ctx.collections.filter(x => !x.rarity && !x.promo))
            const card = _.sample(ctx.cards.filter(y => y.col === col.id && y.level === x))
            const userCard = existingCards.find(y => y.cardid === card.id)
            const alreadyClaimed = cards.filter(x => x.card === card).length
            const count = userCard? (alreadyClaimed + 1) + userCard.amount: alreadyClaimed? alreadyClaimed + 1: 0
            cards.push({
                userCard,
                card,
                count
            })
        })

        if(cards.length === 0)
            return ctx.reply(user, `seems like this ticket is not valid anymore`, 'red', true)

        const cardIds = cards.map(x => x.card.id)

        cards.map(x => {
            if (x.count > 0)
                resp += `**${formatName(x.userCard? Object.assign({}, ctx.cards[x.userCard.cardid], x.userCard): x.card)}** #${x.count}\n`
            else
                resp += `**new** **${formatName(x.card)}**\n`
        })
        resp += `from using **${item.name}**`

        await addUserCards(ctx, user, cardIds)

        pullInventoryItem(user, item.id, index)
        await user.save()

        user.markModified('cards')
        user.lastcard = cards[0].id
        await user.save()

        const pages = cards.map(x => x.card.url)
        return ctx.sendPgn(ctx, user, {
            pages,
            buttons: ['back', 'forward'],
            switchPage: (data) => data.embed.image.url = data.pages[data.pagenum],
            embed: {
                color: colors.green,
                description: resp,
                image: { url: '' }
            },
            edit: true
        })
    },

    recipe: async (ctx, user, item, index) => {
        user = await fetchOnly(user.discord_id)
        let eobject, desc
        const check = await checks.recipe(ctx, user, item)
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
                    return ctx.reply(user, desc, 'red', true)
                eobject.expires = asdate.add(userEffect.expires, item.lasts, 'days')
            }
            user.effects = user.effects.filter(x => x.id != userEffect.id)
            desc = `you got **${effect.name}** ${effect.passive? 'passive':'usable'} Effect Card!
                ${effect.passive? `The countdown timer on this effect has been extended. Find it in \`${ctx.prefix}effect list passives\``:
                `You have extended the number of uses for this effect. Your new usage limit is **${eobject.uses}**`}`
        } else {
            eobject = { id: item.effectid }
            if(!effect.passive) {
                eobject.uses = item.lasts
                eobject.cooldownends = new Date()
            }
            desc = `you got **${effect.name}** ${effect.passive? 'passive':'usable'} Effect Card!
                ${effect.passive? `To use this passive effect equip it with \`/hero equip\``:
                `Use this effect by typing \`/effect use effect_name:${effect.id}\`. Amount of uses is limited to **${item.lasts}**`}`
        }

        ctx.mixpanel.track(
            "Effect Craft", { 
                distinct_id: user.discord_id,
                effect_id: item.id,
                is_passive: effect.passive,
        })

        await removeUserCards(ctx, user, item.cards)

        pullInventoryItem(user, item.id, index)
        user.effects.push(eobject)
        await user.save()

        await completed(ctx, user, item.cards)


        return ctx.reply(user, {
            image: { url: `${ctx.baseurl}/effects/${effect.id}.gif` },
            description: desc
        }, 'blue', true)


    },

    bonus: async (ctx, user, item, index, args) => {
        switch (item.id) {
            case 'slotupgrade':
                let count
                const slots = await UserSlot.find({discord_id: user.discord_id})
                let inactives = slots.filter(x => !x.is_active)
                const expiry = asdate.add(new Date(), 30, 'days')
                if (inactives.length === 0) {
                    const newSlot = new UserSlot()
                    newSlot.discord_id = user.discord_id
                    newSlot.slot_expires = expiry
                    await newSlot.save()
                    count = slots.length + 1
                } else {
                    const reactivate = inactives.shift()
                    reactivate.is_active = true
                    reactivate.slot_expires = expiry
                    await reactivate.save()
                    count = slots.length - inactives.length
                }

                await ctx.reply(user, `congratulations! You have increased the number of your passive effect slots to **${count}**!
                This slot will expire on <t:${Math.floor(expiry/1000)}>`, 'green', true)
                break
            case 'effectincrease':
                const reg = new RegExp(args.effect, 'gi')
                const chosenEffect = user.effects.find(x => reg.test(x.id))
                const itemEffect = ctx.effects.find(x => x.id === chosenEffect.id)

                if (chosenEffect.expires)
                    chosenEffect.expires = asdate.add(chosenEffect.expires, 1, 'days')
                else
                    chosenEffect.uses++

                user.markModified('effects')
                await user.save()

                await ctx.reply(user, `you have successfully increased the ${chosenEffect.expires? 'expiration time': 'use count'} for **${itemEffect.name}** by 1 ${chosenEffect.expires? 'day': 'use'}!`, 'green', true)
                break
            case 'legendswapper':
                const otherLegs = ctx.cards.filter(x => ctx.chosenCard.col === x.col && x.level === 5 && x.id !== ctx.chosenCard.id)
                const card = _.sample(otherLegs)

                const userCard = await findUserCards(ctx, user, [ctx.chosenCard.id])

                if (userCard.length === 0)
                    return ctx.reply(user, `there was error finding the card you selected. Please try again!`, 'red', true)

                await removeUserCards(ctx, user, [ctx.chosenCard.id])
                await addUserCards(ctx, user, [card.id])

                await ctx.reply(user, {
                    image: { url: card.url },
                    description: `You got ${formatName(card)} by swapping your ${formatName(ctx.chosenCard)}!`
                }, 'green', true)
                break
        }
        pullInventoryItem(user, item.id, index)
        await user.save()
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

    recipe: async (ctx, user, item) => {
        const effect = ctx.effects.find(x => x.id === item.effectid)
        let requires
        if(item.cards) {
            const requiredUserCards = await findUserCards(ctx, user, item.cards)
            requires = item.cards.map(x => {
                const has = requiredUserCards.some(y => y.cardid === x)
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
    },

    bonus: (ctx, user, item) => ({
        description: item.fulldesc
    }),
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

    recipe: async (ctx, user, item) => {
        //const now = new Date()

        //Keeping this here in case we for some reason need to revert to not allowing stacking effects
        // if(user.effects.some(x => x.id === item.effectid && (x.expires || x.expires > now)))
        //     return `you already have this Effect Card`

        const requiredUserCards = await findUserCards(ctx, user, item.cards)
        if(item.cards.length != requiredUserCards.length)
            return `you don't have all required cards in order to use this item.
                Type \`${ctx.prefix}inventory info\` to see the list of required cards`

        if(requiredUserCards.find(x => x.fav && x.amount === 1)) {
            const card = requiredUserCards.find(x => x.fav && x.amount === 1)
            return `the last copy of required card ${formatName(ctx.cards[card.cardid])} is marked as favourite.
                    Please, use \`${ctx.prefix}fav remove one card_query:${ctx.cards[card.cardid].name}\` to remove it from favourites first`
        }
    },

    bonus: async (ctx, user, item, args) => {
        switch (item.id) {
            case 'slotupgrade':
                const userLevel = XPtoLEVEL(user.xp)
                if (userLevel < 100)
                    return `you need to be at least \`/profile\` level 100 before using this item!`

                const slots = await UserSlot.find({discord_id: user.discord_id, is_active: true})
                if (slots.length >= Math.floor(userLevel / 100) + 2)
                    return `you already have the maximum amount of hero slots for your level. You can unlock one every 100 levels!`
                return false
            case 'effectincrease':
                if (!args.effect)
                    return `you need to supply an effect name with the \`effect_name:\` option!`
                const reg = new RegExp(args.effect, 'gi')
                const chosenEffect = user.effects.find(x => reg.test(x.id))
                if (!chosenEffect)
                    return `you either don't have \`${args.effect}\` or it is spelled incorrectly. Please try again!`
                const itemEffect = ctx.effects.find(x => x.id === chosenEffect.id)
                if (itemEffect.passive && !chosenEffect.expires)
                    return `you need to equip this effect before you can increase it's time length!`
                ctx.chosenEffectItem = ctx.items.find(x => x.id === chosenEffect.id)
                return false
            case 'legendswapper':
                const userCards = await getUserCards(ctx, user)
                const map = mapUserCards(ctx, userCards)
                const cards = filter(map, args)

                const card = bestMatch(cards.filter(x => x.fav? x.amount > 1: x.amount))

                if (!card)
                    return `you need to specify a legendary card that is either not favorited or that you have a multi of!`

                const colLegs = ctx.cards.filter(x => x.col === card.col && x.level === 5)

                if (colLegs.length === 1)
                    return `you cannot use this item on a collection that only has one legendary card!`
                if (colLegs.length === 0)
                    return  `you cannot use this item on a collection without a legendary card!`
                if (card.level !== 5)
                    return `you need to specify a legendary card to swap!`

                ctx.chosenCard = card

                return false
        }
    },
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
    },
    bonus: (ctx, user, item) => user.inventory.push({ id: item.id, time: new Date() })
}

const getQuestion = (ctx, user, item) => {
    switch(item.type) {
        case 'blueprint': return `Do you want to build **${item.name}** in **${ctx.interaction.channel.guild.name}**?`
        case 'claim_ticket': return `Do you want to use **${item.name}** to get **${_.isArray(item.level)? `${item.level.length} ${item.level[0]}`: `1 ${item.level}`} ★** card(s)?`
        case 'recipe': return `Do you want to convert **${item.name}** into an Effect Card? The required cards will be consumed`
        case 'bonus':
            switch (item.id) {
                case 'legendswapper':
                    return `Do you want to use the **${item.name}** to swap ${formatName(ctx.chosenCard)} for another legendary in it's collection?`
                case 'slotupgrade':
                    return `Do you want to use the **${item.name}** to increase your passive effect slots?`
                case 'effectincrease':
                    return `Do you want to use the **${item.name}** to increase ${ctx.chosenEffectItem.name}'s uses/time?`
            }
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
