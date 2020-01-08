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

module.exports = {
	fetchOrCreate
}