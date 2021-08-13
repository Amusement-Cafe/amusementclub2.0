const {cmd, pcmd}   = require('../utils/cmd')
const Plots         = require('../collections/plot')
const colors        = require('../utils/colors')

const {
    XPtoLEVEL,
    numFmt,
}   = require('../utils/tools')


const {
    getGuildPlots,
    getUserPlots,
}   = require('../modules/plot')

cmd(['plot'], ['plots'], async (ctx, user) => {
    const lots = await getUserPlots(ctx)
    if (lots.length === 0 )
        return ctx.reply(user, 'You have no plots!', 'red')
    let pages = []

    lots.map((x, i) => {
        if (i % 10 == 0) pages.push("`Plot # | Building | Level | Revenue`\n")
        let buildingName = x.building.id? x.building.id.padEnd(8) : 'None    '
        let level = x.building.id? x.building.level.toString().padEnd(5) : 'N/A  '
        let lemons = x.building.id? `${numFmt(x.building.stored_lemons)} 🍋`: 'N/A'
        pages[Math.floor(i/10)] += `\`${(i+1).toString().padEnd(6)} | ${buildingName} | ${level} | ${lemons}\`\n`
    })

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages,
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, you have ${lots.length} plots in this guild` },
            color: colors.blue,
        }
    })
})

cmd(['plot', 'global'], ['plots', 'global'], async (ctx, user) => {
    const lots = await getUserPlots(ctx, true)

    let pages = []

    lots.map((x, i) => {
        if (i % 10 == 0) pages.push("`Plot # | Building | Level | Lemons | Guild Name`\n")
        let buildingName = x.building.id? x.building.id.padEnd(8) : 'None    '
        let level = x.building.id? x.building.level.toString().padEnd(5) : 'N/A  '
        let lemons = x.building.id? `${numFmt(x.building.stored_lemons)}`.padEnd(6): 'N/A   '
        pages[Math.floor(i/10)] += `\`${(i+1).toString().padEnd(6)} | ${buildingName} | ${level} | ${lemons} | ${x.guild_name}\`\n`
    })
    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages,
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `${user.username}, you have ${lots.length} plots globally` },
            color: colors.blue,
        }
    })
})

cmd(['plot', 'buy'], async (ctx, user) => {
    const maxGuildAmount = Math.round(XPtoLEVEL(ctx.guild.xp) / 10) + 1
    const maxUserAmount = Math.round(XPtoLEVEL(user.xp) / 2) + 1
    const userGuildPlots = await getUserPlots(ctx)
    const userGlobalPlots = await getUserPlots(ctx, true)
    const cost = 50 + (userGlobalPlots.length * 50)


    const check = async () => {

        if (user.lemons < cost)
            return ctx.reply(user, `you don't have enough lemons to afford this plot!\nYou need ${numFmt(cost)} ${ctx.symbols.lemon} to purchase another plot!`, 'red')

        if (userGuildPlots.length >= maxGuildAmount)
            return ctx.reply(user, 'you have the maximum amount of plots available for this guild!\nWait for the guild level to raise to get more!', 'red')

        if (userGlobalPlots.length >= maxUserAmount)
            return ctx.reply(user, `you have the maximum amount of plots available globally!\nUse the bot and gain \`${ctx.guild.prefix}profile\` levels to be able to buy more!`, 'red')

    }

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question: `Would you like to purchase a plot in **${ctx.msg.channel.guild.name}**? It will cost you ${numFmt(cost)} ${ctx.symbols.lemon}!`,
        force: ctx.globals.force,
        check,
        onConfirm: async () => {
            let newLot = new Plots
            newLot.user_id = ctx.msg.author.id
            newLot.guild_id = ctx.guild.id
            newLot.guild_name = ctx.discord_guild.name
            await newLot.save()
            user.lemons -= cost
            await user.save()
            ctx.guild.lemons += cost
            await ctx.guild.save()
            ctx.reply(user, `you have bought a plot in **${ctx.msg.channel.guild.name}**!
            You are able to buy ${maxGuildAmount - (userGuildPlots.length + 1)} more plots in this guild!`)
        },
    })
})

cmd(['plot', 'upgrade'], async (ctx, user, arg) => {
    if (!arg)
        return ctx.reply(user, 'please specify a building or plot number to upgrade!', 'red')

    let plot = await getUserPlots(ctx, false, arg)

    if (plot.length === 0)
        plot = await getUserPlots(ctx, false)

    if (arg - 1 > plot.length)
        return ctx.reply(user, `no plot found in position ${arg}!`, 'red')

    plot = plot[arg - 1] || plot[0]

    if (!plot || !plot.building.id)
        return ctx.reply(user, `no plots found with a building with the argument **${arg}**!`, 'red')

    const item = ctx.items.find(x => x.id === plot.building.id)
    const level = item.levels[plot.building.level]
    const userLvl = XPtoLEVEL(user.xp)

    if(!level)
        return ctx.reply(user, `**${item.name}** is already max level`, 'red')

    if(userLvl < level.level)
        return ctx.reply(user, `you need to be level ${level.level} to upgrade this building! See your level in \`${ctx.guild.prefix}profile\``, 'red')

    if(user.lemons < level.price)
        return ctx.reply(user, `you have to have at least **${numFmt(level.price)}** ${ctx.symbols.lemon} to upgrade this building`, 'red')

    const question = `Do you want to upgrade **${item.name}** to level **${plot.building.level + 1}** for **${numFmt(level.price)}** ${ctx.symbols.lemon}?`

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question,
        force: ctx.globals.force,
        onConfirm: async (x) => {
            const xp = Math.floor(level.price * .04)
            plot.building.level++
            user.lemons -= level.price
            user.xp += xp
            await user.save()
            await plot.save()

            ctx.mixpanel.track(
                "Building Upgrade", {
                    distinct_id: user.discord_id,
                    building_id: item.id,
                    building_level: plot.building.level,
                    price: level.price,
                    guild: ctx.guild.id,
                })

            return ctx.reply(user, `you successfully upgraded **${item.name}** to level **${plot.building.level}**!
                This building now *${level.desc.toLowerCase()}*
                You have been awarded **${Math.floor(xp)} xp** towards your next rank`)

        },
    })
})

cmd(['plot', 'info'], ['plot', 'status'], async (ctx, user, arg) => {
    if (!arg)
        return ctx.reply(user, 'please specify a plot number to see info on!', 'red')

    let plot = await getUserPlots(ctx, false)
    let plotLength = plot.length

    if (plot.length === 0)
        return ctx.reply(user, 'You have no plots!', 'red')

    let plotArg = arg - 1
    plot = plot[plotArg]
    if(!plot)
        return ctx.reply(user, `you don't have a plot in position ${arg}, you only have ${plotLength} plots in this guild!`, 'red')

    if(!plot.building.id)
        return ctx.reply(user, `this is an empty plot! You can buy buildings from the \`${ctx.guild.prefix}store\` and place them on this plot!`)

    const item = ctx.items.find(x => x.id === plot.building.id)

    const embed = {
        author: { name: `${user.username}, here are the stats for your ${item.name}` },
        fields: [
            {
                name: `Stored Revenue`,
                value: `${numFmt(plot.building.stored_lemons)} ${ctx.symbols.lemon}`,
                inline: true
            },
            {
                name: `Installation Date`,
                value: `${plot.building.install_date.toLocaleString()}`,
                inline: true
            },
            {
                name: `Last Collected Date`,
                value: `${plot.building.last_collected.toLocaleString()}`,
                inline: true
            },
        ],
        color: colors.blue
    }

    let level = item.levels.map((x, i) => ({
        name: `Level ${i + 1}`,
        value: `Price: **${numFmt(x.price)}** ${ctx.symbols.lemon}
                > ${x.desc.replace(/{currency}/gi, ctx.symbols.lemon)}`
    }))
    level[plot.building.level - 1].name += ` (Current Level)`
    level.map(x => embed.fields.push(x))


    return ctx.send(ctx.msg.channel.id, embed, user.discord_id)


})

cmd(['plot', 'collect'], ['plots', 'collect'], async (ctx, user) => {
    let plots = await getUserPlots(ctx)
    plots = plots.filter(x=> x.building.stored_lemons > 0)

    if (plots.length === 0)
        return ctx.reply(user, 'you have no plots in this guild that are ready for collection!', 'red')

    let collection = 0
    plots.map(x => collection += x.building.stored_lemons)

    const question = `Do you want to collect **${numFmt(collection)}** ${ctx.symbols.lemon} from your buildings in ${ctx.discord_guild.name}?`
    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question,
        force: ctx.globals.force,
        onConfirm: async (x) => {
            plots.map(async y => {
                y.building.stored_lemons = 0
                y.building.last_collected = new Date()
                await y.save()
            })
            user.lemons += collection
            await user.save()

            return ctx.reply(user, `you have successfully collected **${numFmt(collection)}** ${ctx.symbols.lemon} from this guild! 
            You now have **${numFmt(user.lemons)}** ${ctx.symbols.lemon}`)
        }
    })
})

pcmd(['admin'], ['sudo', 'plots', 'clear'], async (ctx, user) => {
    const demolished  = await Plots.deleteMany({guild_id: ctx.guild.id})
    if (demolished.n > 0)
        return ctx.reply(user, 'guild lots demolished!')
    else
        return ctx.reply(user, 'no lots to be demolished!', 'red')
})
