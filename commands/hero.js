const {cmd}     = require('../utils/cmd')
const jikanjs   = require('jikanjs')
const asdate    = require('add-subtract-date')
const msToTime  = require('pretty-ms')
const colors    = require('../utils/colors')

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
    getInfo
} = require('../modules/hero')

const { 
    itemInfo
} = require('../modules/item')

cmd(['hero'], withUserEffects(async (ctx, user, effects, ...args) => {
    if(!user.hero)
        return ctx.reply(user, `you don't have a hero yet`, 'red')

    const embed = await getInfo(ctx, user, user.hero)
    embed.fields = [
        { name: `Effect Card slot 1`, value: formatUserEffect(ctx, user, effects.find(x => x.id === user.heroslots[0])) || 'Empty' },
        { name: `Effect Card slot 2`, value: formatUserEffect(ctx, user, effects.find(x => x.id === user.heroslots[1])) || 'Empty' },
    ]

    return ctx.send(ctx.msg.channel.id, embed, user.discord_id)
}))

cmd(['hero', 'get'], withHeroes(async (ctx, user, heroes) => {
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

    return ctx.send(ctx.msg.channel.id, embed, user.discord_id)
}))

cmd(['heroes'], ['hero', 'list'], withHeroes(async (ctx, user, heroes) => {
    heroes.sort((a, b) => b.xp - a.xp)
    const pages = ctx.pgn.getPages(heroes.map((x, i) => `${i + 1}. **${x.name}** lvl **${XPtoLEVEL(x.xp)}**`))

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
        embed: {
            author: { name: `Your Effect Cards` },
            color: colors.blue,
        }
    })
}))

cmd(['slots'], ['hero', 'slots'], withUserEffects(async (ctx, user, effects, ...args) => {

    const now = new Date()
    effects = effects.filter(x => x.expires > now)
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
    userEffect.uses--
    userEffect.cooldownends = asdate.add(new Date(), effect.cooldown, 'hours')
    user.effects = user.effects.filter(x => x.expires || x.uses > 0)
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
        embed.description += `\nEffect Card has been used and now on cooldown\n**${userEffect.uses}** uses left`
    }

    return ctx.reply(user, embed)
}))

cmd(['equip'], ['hero', 'equip'], withUserEffects(async (ctx, user, effects, ...args) => {
    const passives = effects.filter(x => x.passive)

    let intArgs = args.filter(x => !isNaN(x)).map(x => parseInt(x))
    const slotNum = intArgs.shift()
    if(!slotNum || slotNum < 1 || slotNum > 2)
        return ctx.reply(user, `please specify valid slot number`, 'red')

    args = args.filter(x => x != slotNum)

    let effect
    if(intArgs[0]) {
        effect = passives[intArgs[0] - 1]
    } else {
        const reg = new RegExp(args.join(''), 'gi')
        effect = passives.find(x => reg.test(x.id))
    }

    if(!effect)
        return ctx.reply(user, `effect with ID \`${args.join('')}\` was not found or it is not a passive`, 'red')

    if(user.heroslots.includes(effect.id))
        return ctx.reply(user, `passive **${effect.name}** is already equipped`, 'red')

    const now = new Date()
    if(user.herocooldown[slotNum - 1] && user.herocooldown[slotNum - 1] > now)
        return ctx.reply(user, `you can use this slot in **${msToTime(user.herocooldown[slotNum - 1] - now)}**`, 'red')

    const equip = () => {
        user.heroslots[slotNum - 1] = effect.id
        user.herocooldown[slotNum - 1] = asdate.add(new Date(), 1, 'day')
        user.markModified('heroslots')
        user.markModified('herocooldown')
        return user.save()
    }

    if(user.heroslots[slotNum - 1]) {
        const oldEffect = passives.find(x => x.id === user.heroslots[slotNum - 1])
        return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
            force: ctx.globals.force,
            question: `Do you want to replace **${oldEffect.name}** with **${effect.name}** in slot #${slotNum}?`,
            onConfirm: (x) => equip(),
        })
    }

    await equip()
    return ctx.reply(user, `successfully equipped **${effect.name}** to slot **#${slotNum}**. Effect is now active`)
}))

cmd(['hero', 'submit'], async (ctx, user, arg1) => {
    if(XPtoLEVEL(user.xp) < 25)
        return ctx.reply(user, `you have to be level **25** or higher to submit a hero`, 'red')

    if(!arg1)
        return ctx.reply(user, `please specify MAL character URL`, 'red')

    const price = 512 * (2 ** user.herosubmits)
    if(user.exp < price)
        return ctx.reply(user, `you have to have at least **${price}** ${ctx.symbols.tomato} to submit a hero`, 'red')

    const charID = arg1.replace('https://', '').split('/')[2]
    if(!charID)
        return ctx.reply(user, `seems like this URL is invalid.
            Please specify MAL character URL`, 'red')

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
        return ctx.reply(user, `you can submit new hero in **${msToTime(recent.submitted - past, {compact: true})}**`, 'red')

    let char
    try {
        char = await jikanjs.loadCharacter(charID)
    } catch { }

    if(!char)
        return ctx.reply(user, `cannot find a valid character on this URL`, 'red')

    if(!char.animeography[0])
        return ctx.reply(user, `seems like this character doesn't have any asociated anime.
            Only characters with valid animeography are allowed`, 'red')

    const embed = { 
        title: `Submitting a hero`,
        description: `you are about to submit **${char.name}** from **${char.animeography[0].name}**.
        > It may take up to a week to review the character. You will have your current hero which would be automatically replaced if character is accepted.
        Proceed?`,
        image: { url: char.image_url }
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
