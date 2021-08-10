const Plots = require('../collections/plot')


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
        if (x.building.level >= requiredLevel){
            x.building.stored_lemons += amount
            await x.save()
        }
    })
}




module.exports = {
    getGuildPlots,
    getUserPlots,
    plotPayout
}
