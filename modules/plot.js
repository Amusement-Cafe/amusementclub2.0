const Plots = require('../collections/plot')
const asdate = require('add-subtract-date')
const {
    getBuilding,
} = require("./guild")


const baseStorageCaps = [300, 600, 1200, 1800, 3600, 7200]

const plotCost = async (ctx, user) => {
    const userPlotsLength = (await getUserPlots(ctx, true, null, user? user.discord_id: null)).length
    return 25 * (2 ** userPlotsLength)
}

const getLemonCap = async (ctx, user) => {
    const nextPlotCost = await plotCost(ctx, user)
    if (nextPlotCost < 100000)
        return 100000

    return nextPlotCost
}

const getUserPlots = async (ctx, global = false, building, user_id, guild_id) => {
    let q = {user_id: ctx.interactionUser.id}
    if (user_id)
        q.user_id = user_id
    if (!global)
        q.guild_id = guild_id || ctx.guild.id
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

const getBuildingPlots = async (ctx, building) => {
    return await Plots.find({'building.id': building})
}

const plotPayout = async (ctx, building, requiredLevel, amount = 0, guildID, userID) => {
    //I have to do this somewhere as the secondaryCheck sometimes doesn't have full ctx info due to it running via resolve
    if (guildID && userID) {
        ctx.msg = {author:{id: userID}}
        ctx.guild = {id: guildID}
    }
    if (!ctx.guild)
        return

    let relatedPlots = await getGuildPlots(ctx, building)
    if (relatedPlots.length === 0)
        return

    const hasBuilding = await getBuilding(ctx, ctx.guild.id, 'processingplant')
    const multiplier = hasBuilding && hasBuilding.level > 1? hasBuilding.level === 4? 1.15: 1.1 : 1
    relatedPlots.map(async x => {
        const maxCap = await getMaxStorage(ctx, x)
        let payAmount = amount
        if (x.building.level >= requiredLevel && x.building.stored_lemons < maxCap){
            if (building === 'auchouse')
                payAmount = amount * x.building.level

            payAmount = payAmount * multiplier

            x.building.stored_lemons += Math.round(payAmount)

            if (x.building.stored_lemons > maxCap)
                x.building.stored_lemons = maxCap

            await x.save()
        }
    })
}

const castlePayments = async (ctx, now) => {
    const castles = await getBuildingPlots(ctx, 'castle')
    if (castles.length === 0)
        return

    castles.map(async x => {
        if (x.next_check > now)
            return
        let level = x.building.level

        let maxStored = baseStorageCaps[level]
        const maxLvlStored = maxStored + ((maxStored * ((level * 25) / 100)))

        x.building.stored_lemons += (level * 10) + 20

        if (level > 1 && maxLvlStored < x.building.stored_lemons)
            x.building.stored_lemons = maxLvlStored
        else if (maxStored < x.building.stored_lemons)
            x.building.stored_lemons = maxStored

        x.next_check = asdate.add(new Date(), 24, 'hours')
        await x.save()
    })
}

const getMaxStorage = async (ctx, plot) => {
    let castle = await getUserPlots(ctx, false, 'castle', plot.user_id, plot.guild_id)
    const baseCapacity = baseStorageCaps[plot.building.level]
    const castleLevel = castle[0].building.level
    const multiplied = await getBuilding(ctx, plot.guild_id, 'lemonadestand')
    let multiplier = 1

    if (multiplied)
        multiplier = 1 + (multiplied.level * 0.1)

    if (castleLevel <= 1)
        return baseCapacity * multiplier

    return  Math.floor((baseCapacity + ((baseCapacity * ((castleLevel * 25) / 100)))) * multiplier)
}




module.exports = {
    castlePayments,
    getBuildingPlots,
    getGuildPlots,
    getLemonCap,
    getMaxStorage,
    getUserPlots,
    plotPayout,
    plotCost,
}
