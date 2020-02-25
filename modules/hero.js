const Hero          = require('../collections/hero')
const User          = require('../collections/user')
const { fetchOnly } = require('./user')
const jikanjs       = require('jikanjs')
const {XPtoLEVEL}   = require('../utils/tools')
const _             = require('lodash')
const colors        = require('../utils/colors')

const new_hero = async (ctx, user, char) => {
    const pics = await jikanjs.loadCharacter(char.mal_id, 'pictures')

    const hero = await new Hero()
    hero.id = char.mal_id
    hero.name = char.name
    hero.user = user.discord_id
    hero.submitted = new Date()
    hero.pictures = pics.pictures.map(x => x.large)

    await hero.save()
}

const get_hero = (ctx, id) => {
    return Hero.findOne({ id })
}

const get_all = (ctx, q = {}) => {
    q.active = true
    return Hero.find(q)
}

const get_userSumbissions = (ctx, user) => {
    return Hero.find({ user: user.discord_id })
}

const check_heroes = async (ctx, now) => {
    const pending = await Hero.findOne({ accepted: true, active: false })
    if(pending) {
        const user = await fetchOnly(pending.user)
        user.hero = pending.id
        user.herochanged = now
        pending.active = true
        await user.save()
        await pending.save()
        await ctx.direct(user, `congratulations! Your hero request has been accepted.
            Say hello to your new hero **${pending.name}**`)
    }
}

const getInfo = async (ctx, user, id) => {
    const hero = await get_hero(ctx, id)
    const followers = await User.countDocuments({ hero: hero.id })
    return { 
        author: { name: hero.name },
        description: `Level **${XPtoLEVEL(hero.xp)}**\nFollowers: **${followers}**`,
        image: { url: _.sample(hero.pictures) },
        color: colors.blue
    }
}

const withHeroes = (callback) => async (ctx, user, ...args) => {
    const query = (args && args.length > 0)? { name: new RegExp(args.join('.*'), 'gi') } : {}
    const list = await get_all(ctx, query)

    if(list.length === 0)
        return ctx.reply(user, `no heroes found matching that request`, 'red')
    
    return callback(ctx, user, list)
}

module.exports = {
    new_hero,
    get_hero,
    get_userSumbissions,
    check_heroes,
    get_all,
    withHeroes,
    getInfo
}
