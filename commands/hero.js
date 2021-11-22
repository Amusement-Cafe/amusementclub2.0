const { Expedition, Guild } = require('../collections')

const {cmd, pcmd}   = require('../utils/cmd')
const asdate        = require('add-subtract-date')
const msToTime      = require('pretty-ms')
const anilist       = require('anilist-node');
const colors        = require('../utils/colors')

const {
    fetchOnly,
} = require('../modules/user')

const {
    XPtoLEVEL,
    numFmt,
} = require('../utils/tools')

const {
    formatUserEffect,
    withUserEffects,
} = require('../modules/effect')

const { 
    new_hero,
    get_hero,
    get_userSubmissions,
    withHeroes,
    getInfo,
    reloadCache,
} = require('../modules/hero')

const { 
    itemInfo,
} = require('../modules/item')

const {
    check_effect,
} = require('../modules/effect')

const {
    format_gain,
} = require('../modules/expedition')

const Anilist = new anilist();

cmd(['hero'], withUserEffects(async (ctx, user, effects, ...args) => {
    const now = new Date()
    await user.save()
    effects = effects.filter(x => !x.expires || x.expires > now)
    if(!user.hero)
        return ctx.reply(user, `you don't have a hero yet. To get one use \`${ctx.prefix}hero get [hero name]\`. See list with \`${ctx.prefix}hero list\``, 'red')

    const embed = await getInfo(ctx, user, user.hero)
    embed.fields = [
        { name: `Effect Card slot 1`, value: formatUserEffect(ctx, user, effects.find(x => x.id === user.heroslots[0])) || 'Empty' },
        { name: `Effect Card slot 2`, value: formatUserEffect(ctx, user, effects.find(x => x.id === user.heroslots[1])) || 'Empty' },
    ]

    return ctx.send(ctx.msg.channel.id, embed, user.discord_id)
}))

cmd(['hero', 'get'], withHeroes(async (ctx, user, heroes, isEmpty) => {
    if(isEmpty)
        return ctx.reply(user, `please specify hero name`, 'red')

    const hero = await get_hero(ctx, heroes[0].id)
    const past = asdate.subtract(new Date(), 7, 'days')
    if(user.herochanged > past)
        return ctx.reply(user, `you can get a new hero in **${msToTime(user.herochanged - past)}**`, 'red')

    if(hero.id === user.hero)
        return ctx.reply(user, `you already have **${hero.name}** as a hero`, 'red')

    const lasthero = await get_hero(ctx, user.hero)
    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question: `Do you want to set **${hero.name}** as your current hero?`,
        onConfirm: async (x) => {
            user.hero = hero.id
            user.herochanged = new Date()
            await user.save()

            hero.followers++
            await hero.save()

            if(lasthero) {
                lasthero.followers--
                await lasthero.save()
            }

            ctx.mixpanel.track(
                "Hero Get", { 
                    distinct_id: user.discord_id,
                    hero_id: hero.id,
                    hero_name: hero.name,
                    hero_followers: hero.followers,
            })

            return ctx.reply(user, `say hello to your new hero **${hero.name}**!`)
        }
    })
}))

cmd(['hero', 'info'], withHeroes(async (ctx, user, heroes, isEmpty) => {
    if(isEmpty) return ctx.qhelp(ctx, user, 'hero')

    const hero = heroes[0]
    const usr = await fetchOnly(hero.user)
    const embed = await getInfo(ctx, user, hero.id)
    embed.description += `\nSubmitted by: **${usr.username}**`

    const guild = await Guild.findOne({ hero: hero.id })
    if(guild) {
        const discord_guild = ctx.bot.guilds.find(x => x.id === guild.id)
        if(discord_guild)
            embed.description += `\nCurrent guild: **${discord_guild.name}**`
    }

    return ctx.send(ctx.msg.channel.id, embed, user.discord_id)
}))

cmd(['heroes'], ['hero', 'list'], withHeroes(async (ctx, user, heroes) => {
    heroes.sort((a, b) => b.xp - a.xp)
    const pages = ctx.pgn.getPages(heroes.map((x, i) => `${i + 1}. \`[${x.id}]\` **${x.name}** lvl **${XPtoLEVEL(x.xp)}**`))

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages,
        buttons: ['back', 'forward'],
        embed: {
            title: `Matching hero list`,
            color: colors.blue,
        }
    })
}))

cmd(['effect', 'info'], ['hero', 'effect', 'info'], (ctx, user, ...args) => {
    if(args.length === 0)
        return ctx.qhelp(ctx, user, 'effect')

    const reg = new RegExp(args.join('*.'), 'gi')
    let item = ctx.items.find(x => reg.test(x.id))

    if(!item)
        return ctx.reply(user, `item with ID \`${args.join('')}\` not found`, 'red')

    const embed = itemInfo(ctx, user, item)
    embed.author = { name: item.name }
    embed.description = embed.fields[0].value
    embed.fields = embed.fields.slice(1)
    embed.image = { url: `${ctx.baseurl}/effects/${item.effectid}.gif` }
    embed.color = colors.blue

    return ctx.send(ctx.msg.channel.id, embed, user.discord_id)
})

cmd(['effects'], ['hero', 'effects'], withUserEffects(async (ctx, user, effects, ...args) => {

    if(!effects.some(x => !x.passive))
        return ctx.reply(user, `you don't have any usable effects. To view passives use \`->hero slots\``, 'red')

    const pages = ctx.pgn.getPages(effects.filter(x => x.uses)
        .sort((a, b) => a.cooldownends - b.cooldownends)
        .map((x, i) => {
            const remaining = x.cooldownends - new Date()
            return `${i + 1}. [${remaining > 0? msToTime(remaining, {compact:true}):'ready'}] ${formatUserEffect(ctx, user, x)}`
        }), 5)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages,
        buttons: ['back', 'forward'],
        switchPage: (data) => data.embed.fields[0] = { name: `Usable Effect Cards`, value: data.pages[data.pagenum] },
        embed: {
            author: { name: `${user.username}, your Effect Cards` },
            description: `To use an effect: \`->hero use [effect id]\`
                To view your passives: \`->hero slots\``,
            fields: [],
            color: colors.blue
        }
    })
}))

cmd(['slots'], ['hero', 'slots'], withUserEffects(async (ctx, user, effects, ...args) => {
    const now = new Date()
    effects = effects.filter(x => !x.expires || x.expires > now)

    const hero = await get_hero(ctx, user.hero)
    const pages = ctx.pgn.getPages(effects.filter(x => x.passive)
        .map((x, i) => `${i + 1}. ${formatUserEffect(ctx, user, x)}`), 5).filter(y => y)


    if(pages.length === 0)
        pages.push(`You don't have any passive Effect Cards`)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages,
        buttons: ['back', 'forward'],
        switchPage: (data) => data.embed.fields[2].value = data.pages[data.pagenum],
        embed: {
            description: `**${hero.name}** card slots:
                (\`->hero equip [slot] [passive]\` to equip passive Effect Card)`,
            color: colors.blue,
            fields: [
                { name: `Slot 1`, value: `[${user.herocooldown[0] > now? msToTime(user.herocooldown[0] - now, {compact:true}) : '--' }] ${
                    formatUserEffect(ctx, user, effects.find(x => x.id === user.heroslots[0])) || 'Empty'
                }`},
                { name: `Slot 2`, value: `[${user.herocooldown[1] > now? msToTime(user.herocooldown[1] - now, {compact:true}) : '--' }] ${
                    formatUserEffect(ctx, user, effects.find(x => x.id === user.heroslots[1])) || 'Empty'
                }`},
                { name: `All passives`, value: '' }
            ]
        }
    })
}))

cmd(['use'], ['hero', 'use'], ['effect', 'use'], withUserEffects(async (ctx, user, effects, ...args) => {
    if(args.length === 0)
        return ctx.qhelp(ctx, user, 'effect')

    const usables = effects.filter(x => !x.passive).sort((a, b) => a.cooldownends - b.cooldownends)
    const intArg = parseInt(args[0])

    let effect
    if(intArg) {
        effect = usables[intArg - 1]
    } else {
        const reg = new RegExp(args[0], 'gi')
        effect = usables.find(x => reg.test(x.id))
    }

    if(!effect)
        return ctx.reply(user, `effect with ID \`${args[0]}\` was not found or it is not usable`, 'red')

    const userEffect = user.effects.find(x => x.id === effect.id)
    const now = new Date()
    if(effect.cooldownends > now)
        return ctx.reply(user, `effect card **${effect.name}** is on cooldown for **${msToTime(effect.cooldownends - now)}**`, 'red')

    const res = await effect.use(ctx, user, args.slice(1))
    if(!res.used)
        return ctx.reply(user, res.msg, 'red')

    const count = user.effects.length
    const cooldown = check_effect(ctx, user, 'spellcard')? Math.round(effect.cooldown * .6) : effect.cooldown
    userEffect.uses--
    userEffect.cooldownends = asdate.add(new Date(), cooldown, 'hours')
    user.effects = user.effects.filter(x => x.uses === undefined || x.uses > 0)
    user.markModified('effects')

    await user.save()

    const embed = { 
        description: res.msg,
        image: { url: res.img },
        color: colors.green
    }

    if(count > user.effects.length) {
        embed.description += `\nEffect Card has expired. Please make a new one`
    } else {
        embed.description += `\nEffect Card has been used and now on cooldown for **${cooldown}** hour(s)\n**${userEffect.uses}** uses left`
    }

    return ctx.reply(user, embed)
}))

cmd(['equip'], ['hero', 'equip'], withUserEffects(async (ctx, user, effects, ...args) => {
    if(args.length === 0)
        return ctx.qhelp(ctx, user, 'effect')

    const passives = effects.filter(x => x.passive)

    let intArgs = args.filter(x => !isNaN(x)).map(x => parseInt(x))
    const slotNum = intArgs.shift()
    if(!slotNum || slotNum < 1 || slotNum > 2)
        return ctx.reply(user, `please specify valid slot number`, 'red')

    args = args.filter(x => x != slotNum)

    let effect
    const now = new Date()
    if(intArgs[0]) {
        effect = passives[intArgs[0] - 1]
    } else {
        const reg = new RegExp(args.join(''), 'gi')
        effect = passives.find(x => reg.test(x.id))
    }

    if(!effect)
        return ctx.reply(user, `effect with ID \`${args.join('')}\` was not found or it is not a passive`, 'red')

    if(effect.expires && effect.expires < now)
        return ctx.reply(user, `passive **${effect.name}** has expired. Please purchase a new recipe and use it to make a new effect`, 'red')

    if(user.heroslots.includes(effect.id))
        return ctx.reply(user, `passive **${effect.name}** is already equipped`, 'red')
    
    if(user.herocooldown[slotNum - 1] && user.herocooldown[slotNum - 1] > now)
        return ctx.reply(user, `you can use this slot in **${msToTime(user.herocooldown[slotNum - 1] - now)}**`, 'red')

    const equip = async () => {
        if(!effect.expires) {
            const ueffect = user.effects.findIndex(x => x.id === effect.id)
            user.effects[ueffect].expires = asdate.add(new Date(), effect.lasts, 'days')
            user.markModified('effects')
        }
        
        user.heroslots[slotNum - 1] = effect.id
        user.herocooldown[slotNum - 1] = asdate.add(new Date(), 1, 'day')
        user.markModified('heroslots')
        user.markModified('herocooldown')
        
        await user.save()
        return ctx.reply(user, `successfully equipped **${effect.name}** to slot **#${slotNum}**. Effect is now active`)
    }

    const oldEffect = passives.find(x => x.id === user.heroslots[slotNum - 1])
    if(oldEffect && oldEffect.expires > now) {
        return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
            force: ctx.globals.force,
            question: `Do you want to replace **${oldEffect.name}** with **${effect.name}** in slot #${slotNum}?`,
            onConfirm: (x) => equip(),
        })
    }

    return equip()
}))

cmd(['hero', 'submit'], async (ctx, user, arg1) => {
    if(XPtoLEVEL(user.xp) < 25)
        return ctx.reply(user, `you have to be level **25** or higher to submit a hero`, 'red')

    if(!arg1)
        return ctx.reply(user, `please specify Anilist character URL`, 'red')

    const price = 512 * (2 ** user.herosubmits)
    if(user.exp < price)
        return ctx.reply(user, `you have to have at least **${numFmt(price)}** ${ctx.symbols.tomato} to submit a hero`, 'red')

    const charID = arg1.replace('https://', '').split('/')[2]
    if(!charID)
        return ctx.reply(user, `seems like this URL is invalid.
            Please specify Anilist character URL`, 'red')

    const dbchar = await get_hero(ctx, charID)
    if(dbchar && dbchar.active)
        return ctx.reply(user, `hero **${dbchar.name}** already exists. You can pick them from \`->hero list\``)

    if(dbchar && !dbchar.active)
        return ctx.reply(user, `hero **${dbchar.name}** is already pending for approval`, 'yellow')

    const submissions = await get_userSubmissions(ctx, user)
    const past = asdate.subtract(new Date(), 20, 'days')
    if(submissions.some(x => !x.accepted))
        return ctx.reply(user, `you already have a hero pending approval. You cannot add another`, 'red')

    const recent = submissions.find(x => x.submitted > past)
    if(recent)
        return ctx.reply(user, `you can submit a new hero in **${msToTime(recent.submitted - past, {compact: true})}**`, 'red')

    let char
    try {
        char = await Anilist.people.character(parseInt(charID))
    } catch(e) { 
        return ctx.reply(user, `there was a problem with fetching a character from Anilist database.
            Error code: \`${e}\``, 'red')
    }

    if(!char)
        return ctx.reply(user, `cannot find a valid character at this URL`, 'red')

    if(!char.media || char.media.length == 0)
        return ctx.reply(user, `seems like this character doesn't have any associated media.
            Only characters with valid media sources are allowed`, 'red')

    const media = char.media[0]
    const embed = { 
        title: `Submitting a hero`,
        description: `You are about to submit **${char.name.english || char.name.native}** from **${media.title.english || media.title.romaji}**.
        > This submission will cost you **${numFmt(price)}** ${ctx.symbols.tomato}
        > It may take up some time to review the character. You will keep your current hero while the submission is being processed.
        Proceed?`,
        image: { url: char.image.large }
    }

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        embed,
        onConfirm: async (x) => {
            user.herosubmits++
            user.exp -= price
            await user.save()
            await new_hero(ctx, user, char)

            return ctx.reply(user, `your hero suggestion has been submitted and will be reviewed by moderators soon`)
        }
    })
})

cmd(['hero', 'scout'], async (ctx, user, arg1) => {
    if(!user.hero)
        return ctx.reply(user, `you don't have a hero yet. To get one use \`${ctx.prefix}hero get [hero name]\`. See list with \`${ctx.prefix}hero list\``, 'red')

    const now = new Date()
    const existing = await Expedition.findOne({ user: user.discord_id, finished: false })
    if (existing) {
        return ctx.reply(user, `you already have expedition finishing in **${msToTime(existing.finishes - now)}**`, 'red')
    }
    
    const index = parseInt(arg1)
    if (isNaN(index) || index > 4) {
        const formatGain = (x, key) => {
            const len = x[key]
            if(x[key] && len > 0) {
                return `**${x[key][0]}-${x[key][len - 1]}** ${ctx.symbols[`${key}_gem`]}`
            }
        }

        const embed = { 
            description: `please specify index of the expedition location (e.g. \`${ctx.prefix}hero scout 1\`):`,
            fields: ctx.expeditions.map((x, i) => {
                const gain = [formatGain(x, 'green'), formatGain(x, 'purple'), formatGain(x, 'yellow')]
                return {
                    name: `${i + 1}. ${x.name}`,
                    value: `Gain: ${gain.filter(y => y).join(' | ')}\nTime: **${x.time}h**`,
                }
            })
        }

        return ctx.reply(user, embed, 'amethyst')
    }

    const expData = ctx.expeditions[index - 1]
    const embed = { author: { name: `Do you want to send your hero on expedition for ${expData.time}h?`} }

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        embed,
        onConfirm: async (x) => {
            const exp = new Expedition()
            exp.user = user.discord_id
            exp.hero = user.hero
            exp.type = index - 1
            exp.started = new Date()
            exp.finishes = asdate.add(exp.started, expData.time, 'hours')
            await exp.save()

            return ctx.reply(user, `your hero is now on expedition in **${expData.name}** for the next **${expData.time}h**.
                Use \`${ctx.prefix}exp list\` to see your expedition status.
                Use \`${ctx.prefix}prefs set notify exp true\` to get a DM when your expedition is over.`, 'green')
        }
    })
})

cmd(['exp', 'list'], async (ctx, user, arg1) => {
    const history = await Expedition.find({ user: user.discord_id })
    const current = history.find(x => !x.finished)
    const now = new Date()

    if (history.length === 0) {
        return ctx.reply(user, `you don't have any expeditions. To get started use \`${ctx.prefix}hero scout\``, 'red')
    }

    const finishedExp = history.filter(x => x.finished)
    const pages = ctx.pgn.getPages(finishedExp.map(x => {
        return `[${msToTime(now - x.finishes, {compact: true})}] to **${ctx.expeditions[x.type].name}** gained: ${format_gain(ctx, x.gain)}`
    }))

    if (finishedExp.length === 0) {
        pages[0] = 'No expedition history'
    }

    const curData = current? ctx.expeditions[current.type] : undefined
    const embed = {
        description: current? `Hero is currently exploring **${curData.name}**, finishes in **${msToTime(current.finishes - now)}**.` : `No current hero expeditions.`,
        color: colors.amethyst,
        fields: [],
    }

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages,
        embed,
        buttons: ['back', 'forward'],
        switchPage: (data) => data.embed.fields[0] = { name: 'History', value: data.pages[data.pagenum] },
    })
})

pcmd(['admin'], ['sudo', 'hero', 'cache', 'flush'], async (ctx, user) => {
    await reloadCache()
    return ctx.reply(user, 'reset hero cache')
})
