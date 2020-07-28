const {cmd, pcmd}   = require('../utils/cmd')
const asdate        = require('add-subtract-date')
const msToTime      = require('pretty-ms')
const anilist       = require('anilist-node');
const colors        = require('../utils/colors')
const Guild         = require('../collections/guild')

const {
    fetchOnly
} = require('../modules/user')

const {
    XPtoLEVEL
} = require('../utils/tools')

const {
    formatUserEffect,
    withUserEffects
} = require('../modules/effect')

const { 
    new_hero,
    get_hero,
    get_userSumbissions,
    withHeroes,
    getInfo,
    reloadCache
} = require('../modules/hero')

const { 
    itemInfo
} = require('../modules/item')

const {
    check_effect
} = require('../modules/effect')

const Anilist = new anilist();

cmd(['hero'], withUserEffects(async (ctx, user, effects, ...args) => {
    const now = new Date()
    effects = effects.filter(x => !x.expires || x.expires > now)
    if(!user.hero)
        return ctx.reply(user, `you don't have a hero yet. To get one use \`->hero get [hero name]\``, 'red')

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
        .map((x, i) => `${i + 1}. ${formatUserEffect(ctx, user, x)}`), 5)

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
    if(oldEffect) {
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
        return ctx.reply(user, `you have to have at least **${price}** ${ctx.symbols.tomato} to submit a hero`, 'red')

    const charID = arg1.replace('https://', '').split('/')[2]
    if(!charID)
        return ctx.reply(user, `seems like this URL is invalid.
            Please specify Anilist character URL`, 'red')

    const dbchar = await get_hero(ctx, charID)
    if(dbchar && dbchar.active)
        return ctx.reply(user, `hero **${dbchar.name}** already exists. You can pick them from \`->hero list\``)

    if(dbchar && !dbchar.active)
        return ctx.reply(user, `hero **${dbchar.name}** is already pending for approval`, 'yellow')

    const submissions = await get_userSumbissions(ctx, user)
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

    if(!char.media)
        return ctx.reply(user, `seems like this character doesn't have any associated anime.
            Only characters with valid animeography are allowed`, 'red')

    const media = char.media.find(x => x.format === 'TV' || x.format === 'MOVIE')
    if(!media)
        return ctx.reply(user, `seems like this character doesn't have any associated anime.
            Only characters with valid animeography are allowed`, 'red')

    const embed = { 
        title: `Submitting a hero`,
        description: `You are about to submit **${char.name.english}** from **${media.title.english}**.
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

pcmd(['admin'], ['sudo', 'hero', 'cache', 'flush'], async (ctx, user) => {
    await reloadCache()
    return ctx.reply(user, 'reset hero cache')
})
