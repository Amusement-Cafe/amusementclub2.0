const {XPtoLEVEL}   = require('../utils/tools')
const _             = require('lodash')
const colors        = require('../utils/colors')

const {
    getGuildUser,
    isUserOwner,
    addGuildXP
} = require('./guild')

const {
    addUserCard,
    formatName
} = require('./card')

const mapUserInventory = (ctx, user) => {
    return user.inventory.map(x => Object.assign({}, ctx.items.filter(y => y.id === x.id)[0], x))
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

    if(args[0]) {
        const reg = new RegExp(args[0], 'gi')
        items = items.filter(x => reg.test(x.id))
    }

    if(items.length == 0)
        return ctx.reply(user, `no items found`, 'red')

    return callback(ctx, user, items, args)
}

const useItem = (ctx, user, item) => uses[item.type](ctx, user, item)

const uses = {
    blueprint: async (ctx, user, item) => {
        const guild = ctx.guild
        if(guild.buildings.filter(x => x.id === item.id)[0])
            return ctx.reply(user, `this guild already has **${item.name}**`, 'red')

        if(user.exp < item.levels[0].price)
            return ctx.reply(user, `you need at least **${item.levels[0].price}** {currency} to build **${item.name} level 1**`, 'red')

        if(XPtoLEVEL(guild.xp) < item.levels[0].level)
            return ctx.reply(user, `this guild has to be at least level **${item.levels[0].level}** to have **${item.name} level 1**`, 'red')

        if(!isUserOwner(ctx, user) && getGuildUser(ctx, user).rank < guild.buildperm)
            return ctx.reply(user, `you have to be at least rank **${guild.buildperm}** to build in this guild`, 'red')

        const xp = item.levels[0].price * .1

        guild.buildings.push({ id: item.id, level: 1, health: 100 })
        addGuildXP(ctx, user, xp)
        await ctx.guild.save()

        user.exp -= item.levels[0].price
        pullInventoryItem(user, item.id)
        await user.save()

        return ctx.reply(user, `you successfully built **${item.name}** in **${ctx.msg.channel.guild.name}**
            You have been awarded **${Math.floor(xp)} xp** towards your next rank`)
    },

    claim_ticket: async (ctx, user, item) => {
        const col = item.col? ctx.collections.filter(x => x.id === item.col)[0] : _.sample(ctx.collections.filter(x => !x.rarity))
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
    }
}

const getQuestion = (ctx, user, item) => {
    switch(item.type) {
        case 'blueprint': return `Do you want to build **${item.name}** in **${ctx.msg.channel.guild.name}**?`
        case 'claim_ticket': return `Do you want to use **${item.name}** to get a **${item.level}★** card?`
    }
}

const pullInventoryItem = (user, itemid) => {
    const el = user.inventory.filter(x => x.id === itemid)[0]
    _.pullAt(user.inventory, user.inventory.indexOf(el))
    user.markModified('inventory')
}

module.exports = {
    withUserItems,
    useItem,
    getQuestion
}
