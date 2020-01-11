const Guild = require('../collections/guild')

const fetchOrCreate = async (ctx, user, discord_guild) => {
	if(!discord_guild)
		return null

    let guild = await Guild.findOne({ id: discord_guild.id })

    if (!guild) {
        guild = await new Guild()
        guild.id = discord_guild.id
        guild.botchannels = [ctx.msg.channel.id]

        await guild.save()
        await ctx.reply(user, `new guild added. This channel was marked as bot channel`)
    }

    return guild
}

const addGuildXP = async (ctx, user, xp) => {
    let guildUser = ctx.guild.userstats.filter(x => x.id === user.discord_id)[0]
    
    if(!guildUser) {
        guildUser = { id: user.discord_id, xp: 0, rank: 0 }
        ctx.guild.userstats.push(guildUser)
    }

    ctx.guild.xp += xp * .1
    guildUser.xp += xp
    const rank = XPtoRANK(guildUser.xp)

    if(rank > guildUser.rank)
        await ctx.reply(user, `you ranked up in **${ctx.guild.name}!**
            Your rank is now **${rank}**`)

    guildUser.rank = rank
    await ctx.guild.save()
}

const XPtoRANK = (xp) => [10, 100, 500, 2500, 10000].filter(x => xp > x).length



module.exports = {
	fetchOrCreate,
    addGuildXP
}