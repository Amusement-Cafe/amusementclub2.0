const {cmd}         = require('../utils/cmd')
const colors        = require('../utils/colors')
const AsciiTable    = require('ascii-table')
const Users         = require('../collections/user')
const UserCard     = require('../collections/userCard')

const {
    withInteraction,
} = require('../modules/interactions')

const {
    numFmt,
    XPtoLEVEL,
} = require("../utils/tools")

const {
    fetchOnly,
} = require("../modules/user")


cmd(['leaderboard', 'tomatoes'], withInteraction(async (ctx, user, args) => {
    let embed = {
        color: colors.blue
    }
    const greater = await Users.countDocuments({exp: {$gt: user.exp}})
    const topTomatoes = await Users.find({exp: {$gt: 1000}}).sort({exp: 'descending'}).limit(10).lean()
    let table = new AsciiTable('Tomato Leaderboard')
    table.setHeading('Ranking', 'Username', 'Tomatoes')
    topTomatoes.map((x, i) => {
        table.addRow(`${i+1}`, x.username, numFmt(Math.floor(x.exp)))
    })
    if (!topTomatoes.some(x => x.discord_id === user.discord_id))
        table.addRow(`${greater+1}`, user.username, numFmt(Math.floor(user.exp)))
    embed.description = `\`\`\`${table.toString()}\`\`\``
    return ctx.interaction.createMessage({embed: embed})
}))

cmd(['leaderboard', 'vials'], withInteraction(async (ctx, user, args) => {
    let embed = {
        color: colors.blue
    }
    const greater = await Users.countDocuments({vials: {$gt: user.vials}})
    const topVials = await Users.find({vials: {$gt: 100}}).sort({vials: 'descending'}).limit(10).lean()
    let table = new AsciiTable('Vial Leaderboard')
    table.setHeading('Ranking', 'Username', 'Vials')
    topVials.map((x, i) => {
        table.addRow(`${i+1}`, x.username, numFmt(Math.floor(x.vials)))
    })
    if (!topVials.some(x => x.discord_id === user.discord_id))
        table.addRow(`${greater+1}`, user.username, numFmt(Math.floor(user.vials)))
    embed.description = `\`\`\`${table.toString()}\`\`\``
    return ctx.interaction.createMessage({embed: embed})
}))

cmd(['leaderboard', 'lemons'], withInteraction(async (ctx, user, args) => {
    let embed = {
        color: colors.blue
    }
    const greater = await Users.countDocuments({lemons: {$gt: user.lemons}})
    const topLemons = await Users.find({lemons: {$gt: 500}}).sort({lemons: 'descending'}).limit(10).lean()
    let table = new AsciiTable('Lemon Leaderboard')
    table.setHeading('Ranking', 'Username', 'Lemons')
    topLemons.map((x, i) => {
        table.addRow(`${i+1}`, x.username, numFmt(Math.floor(x.lemons)))
    })
    if (!topLemons.some(x => x.discord_id === user.discord_id))
        table.addRow(`${greater+1}`, user.username, numFmt(Math.floor(user.lemons)))
    embed.description = `\`\`\`${table.toString()}\`\`\``
    return ctx.interaction.createMessage({embed: embed})
}))

cmd(['leaderboard', 'cards'], withInteraction(async (ctx, user, args) => {
    let embed = {
        color: colors.blue
    }
    const topUnique = await UserCard.aggregate([{$project: {userid: 1, _id: 0}}]).sortByCount('userid').limit(10)
    let table = new AsciiTable('Unique Card Leaderboard')
    table.setHeading('Ranking', 'Username', 'Card Count')
    for (let i=0; i < topUnique.length; i++) {
        const unique = topUnique[i]
        const fetch = await fetchOnly(unique._id)
        table.addRow(`${i+1}`, fetch.username, numFmt(unique.count))
    }
    embed.description = `\`\`\`${table.toString()}\`\`\``
    return ctx.interaction.createMessage({embed: embed})
}))

cmd(['leaderboard', 'clout'], withInteraction(async (ctx, user, args) => {
    let embed = {
        color: colors.blue
    }
    const clouted = await Users.find({ cloutedcols: {$exists: true, $ne: []} }, {username: 1, cloutedcols: 1, discord_id: 1}).lean()
    let cloutUsers = clouted.map(x => {
        let cloutNum = 0
        x.cloutedcols.map(y => cloutNum += y.amount)
        return {username: x.username, discord_id: x.discord_id, clouts: cloutNum}
    }).sort((a, b) => b.clouts - a.clouts)
    const userEntry = cloutUsers.find(x => x.discord_id === user.discord_id)
    const userPos = cloutUsers.findIndex(x => x.discord_id === user.discord_id)
    cloutUsers = cloutUsers.slice(0, 10)
    let table = new AsciiTable('Clout Leaderboard')
    table.setHeading('Ranking', 'Username', 'Clouts')
    cloutUsers.map((x, i) => {
        table.addRow(`${i+1}`, x.username, x.clouts)
    })
    if (!cloutUsers.some(x => x.discord_id === user.discord_id))
        table.addRow(`${userPos}`, user.username, userEntry.clouts)
    embed.description = `\`\`\`${table.toString()}\`\`\``
    return ctx.interaction.createMessage({embed: embed})
}))

cmd(['leaderboard', 'completed'], withInteraction(async (ctx, user, args) => {
    let embed = {
        color: colors.blue
    }
    const completed = await Users.find({ completedcols: {$exists: true, $ne: []} }, {username: 1, completedcols: 1, discord_id: 1}).lean()
    let completedUsers = completed.map(x => {return {username: x.username, discord_id: x.discord_id, completed: x.completedcols.length}}).sort((a, b) => b.completed - a.completed)
    const userEntry = completedUsers.find(x => x.discord_id === user.discord_id)
    const userPos = completedUsers.findIndex(x => x.discord_id === user.discord_id)
    completedUsers = completedUsers.slice(0, 10)
    let table = new AsciiTable('Completed Leaderboard')
    table.setHeading('Ranking', 'Username', 'Completed #')
    completedUsers.map((x, i) => {
        table.addRow(`${i+1}`, x.username, x.completed)
    })
    if (!completedUsers.some(x => x.discord_id === user.discord_id))
        table.addRow(`${userPos}`, user.username, userEntry.completed)
    embed.description = `\`\`\`${table.toString()}\`\`\``
    return ctx.interaction.createMessage({embed: embed})
}))

cmd(['leaderboard', 'level'], withInteraction(async (ctx, user, args) => {
    let embed = {
        color: colors.blue
    }
    const greater = await Users.countDocuments({xp: {$gt: user.xp}})
    const topLevel = await Users.find({xp: {$gt: 1000}}).sort({xp: 'descending'}).limit(10).lean()
    let table = new AsciiTable('Level Leaderboard')
    table.setHeading('Ranking', 'Username', 'Level')
    topLevel.map((x, i) => {
        table.addRow(`${i+1}`, x.username, XPtoLEVEL(x.xp))
    })
    if (!topLevel.some(x => x.discord_id === user.discord_id))
        table.addRow(`${greater+1}`, user.username, XPtoLEVEL(user.xp))
    embed.description = `\`\`\`${table.toString()}\`\`\``
    return ctx.interaction.createMessage({embed: embed})
}))

