const {cmd}     = require('../utils/cmd')
const jikanjs   = require('jikanjs')
const asdate    = require('add-subtract-date')
const msToTime  = require('pretty-ms')
const colors    = require('../utils/colors')

const {
    XPtoLEVEL
} = require('../utils/tools')

const { 
    new_hero,
    get_hero,
    get_userSumbissions,
    get_all,
    withHeroes,
    getInfo
}   = require('../modules/hero')

cmd(['hero'], async (ctx, user) => {
    if(!user.hero)
        return ctx.reply(user, `you don't have a hero yet`, 'red')

    const embed = await getInfo(ctx, user, user.hero)
    embed.fields = [
        { name: `Effect Card slot 1`, value: `Empty` },
        { name: `Effect Card slot 2`, value: `Empty` },
    ]

    return ctx.send(ctx.msg.channel.id, embed, user.discord_id)
})

cmd(['hero', 'get'], withHeroes(async (ctx, user, heroes) => {
    const hero = heroes[0]
    const past = asdate.subtract(new Date(), 7, 'days')
    if(user.herochanged > past)
        return ctx.reply(user, `you can get a new hero in **${msToTime(user.herochanged - past)}**`, 'red')

    if(hero.id === user.hero)
        return ctx.reply(user, `you already have **${hero.name}** as a hero`, 'red')

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question: `Do you want to set **${hero.name}** as your current hero?`,
        onConfirm: async (x) => {
            user.hero = hero.id
            user.herochanged = new Date()
            await user.save()

            return ctx.reply(user, `say hello to your new hero **${hero.name}**!`)
        }
    })
}))

cmd(['hero', 'info'], withHeroes(async (ctx, user, heroes) => {
    const hero = heroes[0]
    const embed = await getInfo(ctx, user, hero.id)
    return ctx.send(ctx.msg.channel.id, embed, user.discord_id)
}))

cmd(['heroes'], ['hero', 'list'], withHeroes(async (ctx, user, heroes) => {
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

cmd(['hero', 'submit'], async (ctx, user, arg1) => {
    if(!arg1)
        return ctx.reply(user, `please specify MAL character URL`, 'red')

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

    const recent = submissions.filter(x => x.submitted > past)[0]
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
            await new_hero(ctx, user, char)
            return ctx.reply(user, `your hero suggestion has been submitted and will be reviewed by moderators soon`)
        }
    })
})
