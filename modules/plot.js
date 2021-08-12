const Plots = require('../collections/plot')

const baseStorageCaps = [1, 300, 600, 1200, 1800, 3600]

const getUserPlots = async (ctx, global = false, building) => {
    let q = {user_id: ctx.msg.author.id}
    if (!global)
        q.guild_id = ctx.guild.id
    if (building)
        q['building.id'] = building
    return await Plots.find(q)
}

const getGuildPlots = async (ctx, building) => {
    let q = {guild_id: ctx.guild.id}
    if (building)
        q['building.id'] = building
    return await Plots.find(q)
}

const plotPayout = async (ctx, building, requiredLevel, amount = 0) => {
    let relatedPlots = await getGuildPlots(ctx, building)
    if (relatedPlots.length === 0)
        return

    relatedPlots.map(async x => {
        if (ctx.msg.author.id === x.user_id)
            return
        const maxCap = await getMaxStorage(ctx, x)

        if (x.building.level >= requiredLevel && x.building.stored_lemons < maxCap){
            let payAmount = amount

            if (building === 'auchouse')
                payAmount = amount * x.building.level

            x.building.stored_lemons += payAmount

            if (x.building.stored_lemons > maxCap)
                x.building.stored_lemons = maxCap

            await x.save()
        }
    })
}

const getMaxStorage = async (ctx, plot) => {
    return baseStorageCaps[plot.building.level]
}




module.exports = {
    getGuildPlots,
    getUserPlots,
    plotPayout
}
