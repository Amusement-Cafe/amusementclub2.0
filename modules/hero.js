const Hero          = require('../collections/hero')
const User          = require('../collections/user')
const { fetchOnly } = require('./user')
const jikanjs       = require('jikanjs')
const {XPtoLEVEL}   = require('../utils/tools')
const _             = require('lodash')
const colors        = require('../utils/colors')

let hcache = []

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

const get_hero = async (ctx, id) => {
    if(hcache.length === 0)
        await reloadCache()

    const hero = hcache.filter(x => x.id === id)[0]
    if(hero && hero.followers === -1) {
        hero.followers = await User.countDocuments({ hero: id })
        await hero.save
    }

    return hero
}

const get_userSumbissions = (ctx, user) => {
    return Hero.find({ user: user.discord_id })
}

const reloadCache = async () => {
    hcache = await Hero.find()
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
        await reloadCache()
    }
}

const getInfo = async (ctx, user, id) => {
    const hero = await get_hero(ctx, id)
    return { 
        author: { name: hero.name },
        description: `Level **${XPtoLEVEL(hero.xp)}**\nFollowers: **${hero.followers}**`,
        image: { url: _.sample(hero.pictures) },
        color: colors.blue
    }
}

const withHeroes = (callback) => async (ctx, user, ...args) => {
    if(hcache.length === 0)
        await reloadCache()

    let list
    if(args.length > 0) {
        const reg = new RegExp(args.join('.*'), 'gi')
        list = hcache.filter(x => reg.test(x.name))
    } else list = hcache

    if(list.length === 0)
        return ctx.reply(user, `no heroes found matching that request`, 'red')
    
    return callback(ctx, user, list)
}

module.exports = {
    new_hero,
    get_hero,
    get_userSumbissions,
    check_heroes,
    withHeroes,
    getInfo
}
