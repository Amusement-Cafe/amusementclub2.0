const {cmd, pcmd}   = require('../utils/cmd')
const asdate        = require('add-subtract-date')
const msToTime      = require('pretty-ms')
const anilist       = require('anilist-node')
const colors        = require('../utils/colors')
const Guild         = require('../collections/guild')
const UserSlot      = require('../collections/userSlot')


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
    withInteraction,
} = require("../modules/interactions")

const Anilist = new anilist();

cmd(['hero', 'show'], withInteraction(withUserEffects(async (ctx, user, effects, args) => {
    const now = new Date()
    await user.save()
    effects = effects.filter(x => !x.expires || x.expires > now)
    if(!user.hero)
        return ctx.reply(user, `you don't have a hero yet. To get one use \`->hero get [hero name]\``, 'red')

    const embed = await getInfo(ctx, user, user.hero)
    const slots = await UserSlot.find({discord_id: user.discord_id}).lean()
    embed.fields = slots.map((x, i) => {
        return {name: `Effect Card Slot ${i + 1}`, value: formatUserEffect(ctx, user, effects.find(y => y.id === x.effect_name)) || 'Empty'}
    })


    return ctx.send(ctx.interaction, embed, user.discord_id)
}))).access('dm')

cmd(['hero', 'get'], withInteraction(withHeroes(async (ctx, user, heroes, notEmpty) => {
    if(!notEmpty)
        return ctx.reply(user, `please specify hero name`, 'red')

    const hero = await get_hero(ctx, heroes[0].id)
    const past = asdate.subtract(new Date(), 7, 'days')
    if(user.herochanged > past)
        return ctx.reply(user, `you can get a new hero in **${msToTime(user.herochanged - past)}**`, 'red')

    if(hero.id === user.hero)
        return ctx.reply(user, `you already have **${hero.name}** as a hero`, 'red')

    const lasthero = await get_hero(ctx, user.hero)
    return ctx.sendCfm(ctx, user, {
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

            return ctx.reply(user, `say hello to your new hero **${hero.name}**!`, 'green', true)
        }
    })
}))).access('dm')

cmd(['hero', 'info'], withInteraction(withHeroes(async (ctx, user, heroes, notEmpty) => {
    if(!notEmpty) return ctx.qhelp(ctx, user, 'hero')

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

    return ctx.send(ctx.interaction, embed, user.discord_id)
}))).access('dm')

cmd(['hero', 'list'], withInteraction(withHeroes(async (ctx, user, heroes) => {
    heroes.sort((a, b) => b.xp - a.xp)
    const pages = ctx.pgn.getPages(heroes.map((x, i) => `${i + 1}. \`[${x.id}]\` **${x.name}** lvl **${XPtoLEVEL(x.xp)}**`))

    return ctx.sendPgn(ctx, user, {
        pages,
        buttons: ['back', 'forward'],
        embed: {
            title: `Matching hero list`,
            color: colors.blue,
        }
    })
}))).access('dm')

cmd(['effect', 'info'], withInteraction(async (ctx, user, args) => {
    if(!args.effect)
        return ctx.qhelp(ctx, user, 'effect')

    const reg = new RegExp(args.effect, 'gi')
    let item = ctx.items.find(x => reg.test(x.id))

    if(!item)
        return ctx.reply(user, `item with ID \`${args.effect}\` not found`, 'red')

    const embed = await itemInfo(ctx, user, item)
    embed.author = { name: item.name }
    embed.description = embed.fields[0].value
    embed.fields = embed.fields.slice(1)
    embed.image = { url: `${ctx.baseurl}/effects/${item.effectid}.gif` }
    embed.color = colors.blue

    return ctx.send(ctx.interaction, embed, user.discord_id)
})).access('dm')

cmd(['effect', 'list', 'actives'], withInteraction(withUserEffects(async (ctx, user, effects, args) => {

    if(!effects.some(x => !x.passive))
        return ctx.reply(user, `you don't have any usable effects. To view passives use \`->hero slots\``, 'red')

    const pages = ctx.pgn.getPages(effects.filter(x => x.uses)
        .sort((a, b) => a.cooldownends - b.cooldownends)
        .map((x, i) => {
            const remaining = x.cooldownends - new Date()
            return `${i + 1}. [${remaining > 0? msToTime(remaining, {compact:true}):'ready'}] ${formatUserEffect(ctx, user, x)}`
        }), 5)

    return ctx.sendPgn(ctx, user, {
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
}))).access('dm')

cmd(['hero', 'slots'], ['effect', 'list', 'passives'], withInteraction(withUserEffects(async (ctx, user, effects, ...args) => {
    const now = new Date()
    effects = effects.filter(x => !x.expires || x.expires > now)

    const hero = await get_hero(ctx, user.hero)
    const pages = ctx.pgn.getPages(effects.filter(x => x.passive)
        .map((x, i) => `${i + 1}. ${formatUserEffect(ctx, user, x)}`), 5).filter(y => y)

    if(pages.length === 0)
        pages.push(`You don't have any passive Effect Cards`)

    const embed = {
        description: `**${hero.name}** card slots:
                (\`->hero equip [slot] [passive]\` to equip passive Effect Card)`,
        color: colors.blue,
    }

    const slots = await UserSlot.find({discord_id: user.discord_id}).lean()
    embed.fields = slots.map((x, i) => {
        return {name: `Slot ${i + 1}`, value: `[${x.cooldown > now? msToTime(x.cooldown - now, {compact:true}) : '--' }] ${
            formatUserEffect(ctx, user, effects.find(y => y.id === x.effect_name)) || 'Empty'}`}
    })

    embed.fields.push({name: `All passives`, value: '' })

    const start = embed.fields.length - 1

    return ctx.sendPgn(ctx, user, {
        pages,
        buttons: ['back', 'forward'],
        switchPage: (data) => data.embed.fields[start].value = data.pages[data.pagenum],
        embed
    })
}))).access('dm')

cmd(['effect', 'use'], withInteraction(withUserEffects(async (ctx, user, effects, args) => {
    if(!args.effect)
        return ctx.qhelp(ctx, user, 'effect')

    const usables = effects.filter(x => !x.passive).sort((a, b) => a.cooldownends - b.cooldownends)

    let effect, effectArgs
    const reg = new RegExp(args.effect, 'gi')
    effect = usables.find(x => reg.test(x.id))

    if(!effect)
        return ctx.reply(user, `effect with ID \`${args.effect}\` was not found or it is not usable`, 'red')

    const userEffect = user.effects.find(x => x.id === effect.id)
    const now = new Date()
    if(effect.cooldownends > now)
        return ctx.reply(user, `effect card **${effect.name}** is on cooldown for **${msToTime(effect.cooldownends - now)}**`, 'red')

    const res = await effect.use(ctx, user, args)
    if(!res.used)
        return ctx.reply(user, res.msg, 'red')

    const count = user.effects.length
    const cooldown = await check_effect(ctx, user, 'spellcard')? Math.round(effect.cooldown * .6) : effect.cooldown
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
}))).access('dm')

cmd(['hero', 'equip'], withInteraction(withUserEffects(async (ctx, user, effects, args) => {
    if(args.length === 0)
        return ctx.qhelp(ctx, user, 'effect')

    const passives = effects.filter(x => x.passive)

    // let intArgs = args.filter(x => !isNaN(x)).map(x => parseInt(x))
    const slots = await UserSlot.find({discord_id: user.discord_id})
    const slotNum = args.slot
    if(!slotNum || slotNum < 1 || slotNum > slots.length)
        return ctx.reply(user, `please specify valid slot number`, 'red')

    // args = args.filter(x => x != slotNum)

    let effect
    const now = new Date()
    if(!isNaN(parseInt(args.effect))) {
        effect = passives[parseInt(args.effect) - 1]
    } else {
        const reg = new RegExp(args.effect, 'gi')
        effect = passives.find(x => reg.test(x.id))
    }
    const chosenSlot = slots[slotNum - 1]

    if(!effect)
        return ctx.reply(user, `effect with ID \`${args.effect}\` was not found or it is not a passive`, 'red')

    if(effect.expires && effect.expires < now)
        return ctx.reply(user, `passive **${effect.name}** has expired. Please purchase a new recipe and use it to make a new effect`, 'red')

    if(chosenSlot.effect_name === effect.id)
        return ctx.reply(user, `passive **${effect.name}** is already equipped`, 'red')
    
    if(chosenSlot.cooldown && chosenSlot.cooldown > now)
        return ctx.reply(user, `you can use this slot in **${msToTime(chosenSlot.cooldown - now)}**`, 'red')

    const equip = async () => {
        if(!effect.expires) {
            const ueffect = user.effects.findIndex(x => x.id === effect.id)
            user.effects[ueffect].expires = asdate.add(new Date(), effect.lasts, 'days')
            chosenSlot.expires = asdate.add(new Date(), effect.lasts, 'days')
            user.markModified('effects')
        }

        chosenSlot.effect_name = effect.id
        chosenSlot.cooldown = asdate.add(new Date(), 1, 'day')

        await chosenSlot.save()
        return ctx.reply(user, `successfully equipped **${effect.name}** to slot **#${slotNum}**. Effect is now active`, 'green', true)
    }

    const oldEffect = passives.find(x => x.id === chosenSlot.effect_name)
    if(oldEffect && oldEffect.expires > now) {
        return ctx.sendCfm(ctx, user, {
            force: ctx.globals.force,
            question: `Do you want to replace **${oldEffect.name}** with **${effect.name}** in slot #${slotNum}?`,
            onConfirm: (x) => equip(),
        })
    }

    return equip()
}))).access('dm')

cmd(['hero', 'submit'], withInteraction(async (ctx, user, args) => {
    if(XPtoLEVEL(user.xp) < 25)
        return ctx.reply(user, `you have to be level **25** or higher to submit a hero`, 'red')

    const aniLink = args.anilistLink
    if(!aniLink)
        return ctx.reply(user, `please specify Anilist character URL`, 'red')

    const price = 512 * (2 ** user.herosubmits)
    if(user.exp < price)
        return ctx.reply(user, `you have to have at least **${numFmt(price)}** ${ctx.symbols.tomato} to submit a hero`, 'red')

    const charID = aniLink.replace('https://', '').split('/')[2]
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

    return ctx.sendCfm(ctx, user, {
        embed,
        onConfirm: async (x) => {
            user.herosubmits++
            user.exp -= price
            await user.save()
            await new_hero(ctx, user, char)

            return ctx.reply(user, `your hero suggestion has been submitted and will be reviewed by moderators soon`, 'green', true)
        }
    })
})).access('dm')

pcmd(['admin'], ['sudo', 'hero', 'cache', 'flush'], async (ctx, user) => {
    await reloadCache()
    return ctx.reply(user, 'reset hero cache')
})
