const Hero          = require('../collections/hero')

const _             = require('lodash')
const color         = require('../utils/colors')
const { cmd }       = require('../utils/cmd')

const {
    rankXP,
    fetchGuildUsers,
} = require('../modules/guild')

const { 
    get_hero,
} = require('../modules/hero')

const {
    numFmt,
} = require('../utils/tools')

cmd('top', async (ctx, user) => {
    const guildUsers = await fetchGuildUsers(ctx).select('discord_id username hero').lean()
    //const heroes = await Promise.all(guildUsers.map(x => x.hero? get_hero(ctx, x.hero) : {id: -1}))
    const sortedGuildUsers = ctx.guild.userstats
        .sort((a, b) => b.xp - a.xp)
        .sort((a, b) => b.rank - a.rank)

    const pages = ctx.pgn.getPages(sortedGuildUsers.map((x, i) => {
        const curUser = guildUsers.find(y => y.discord_id === x.id)
        const xpSum = rankXP.slice(0, x.rank).reduce((acc, cur) => acc + cur, 0) + x.xp
        //const hero = heroes.find(y => y.id === curUser.hero)
        //return `${i + 1}. **${curUser.username}** (${xpSum}xp) ${hero? `\`${hero.name}\`` : ''}`
        return `${i + 1}. **${curUser.username}** |> ${numFmt(xpSum)}xp`
    }))

    const desc = []
    const curPlayerIndex = sortedGuildUsers.findIndex(x => x.id === user.discord_id)
    desc.push(`> Local rankings by server XP`)
    desc.push(`You are **#${curPlayerIndex + 1}** on this leaderboard`)
    //desc.push(`**${sortedGuildUsers[curPlayerIndex].rank}**`)

    return ctx.sendPgn(ctx, user, {
        pages,
        buttons: ['back', 'forward'],
        switchPage: (data) => data.embed.fields[0].value = data.pages[data.pagenum],
        embed: {
            author: { name: ctx.discord_guild.name },
            thumbnail: { url: ctx.discord_guild.iconURL },
            color: color.blue,
            description: desc.join('\n'),
            fields: [{name: `----------------`, value: ``}],
        }
    })
})

cmd(['top', 'tomatoes'], async (ctx, user) => {
    const guildUserIds = await fetchGuildUsers(ctx).select('discord_id').lean()
    //const guildUsers = await 
    const sortedGuildUsers = ctx.guild.userstats
        .sort((a, b) => b.xp - a.xp)
        .sort((a, b) => b.rank - a.rank)

    const pages = ctx.pgn.getPages(sortedGuildUsers.map((x, i) => {
        const curUser = guildUsers.find(y => y.discord_id === x.id)
        const xpSum = rankXP.slice(0, x.rank).reduce((acc, cur) => acc + cur, 0) + x.xp
        return `${i + 1}. **${curUser.username}** |> ${numFmt(xpSum)}${ctx.symbols.tomato}`
    }))

    const desc = []
    const curPlayerIndex = sortedGuildUsers.findIndex(x => x.id === user.discord_id)
    desc.push(`> Local rankings by amount of tomatoes`)
    desc.push(`You are **#${curPlayerIndex + 1}** on this leaderboard`)
    //desc.push(`**${sortedGuildUsers[curPlayerIndex].rank}**`)

    return ctx.sendPgn(ctx, user, {
        pages,
        buttons: ['back', 'forward'],
        switchPage: (data) => data.embed.fields[0].value = data.pages[data.pagenum],
        embed: {
            author: { name: ctx.discord_guild.name },
            thumbnail: { url: ctx.discord_guild.iconURL },
            color: color.blue,
            description: desc.join('\n'),
            fields: [{name: `----------------`, value: ``}],
        }
    })
})
