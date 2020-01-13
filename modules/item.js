const {XPtoLEVEL}   = require('../utils/tools')
const _ = require('lodash')
const {
    getGuildUser,
    isUserOwner,
    addGuildXP
} = require('./guild')

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
        await addGuildXP(ctx, user, xp)

        user.exp -= item.levels[0].price
        const el = user.inventory.filter(x => x.id === item.id)[0]
        _.pullAt(user.inventory, user.inventory.indexOf(el))
        user.markModified('inventory')
        await user.save()

        return ctx.reply(user, `you successfully built **${item.name}** in **${ctx.msg.channel.guild.name}**
            You have been awarded **${Math.floor(xp)} xp** towards your next rank`)
    }
}

const getQuestion = (ctx, user, item) => {
    switch(item.type) {
        case 'blueprint': return `Do you want to build **${item.name}** in **${ctx.msg.channel.guild.name}**?`
    }
}

module.exports = {
    withUserItems,
    useItem,
    getQuestion
}
