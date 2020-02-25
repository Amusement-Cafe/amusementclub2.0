const Hero      = require('../collections/hero')
const jikanjs   = require('jikanjs')

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

const get_userSumbissions = (ctx, user) => {
    return Hero.find({ user: user.discord_id })
}

const tick = () => {
    const pending = Hero.find({ accepted: true, active: false })

}

//setInterval(tick.bind(this), 60000 * 5);

module.exports = {
    new_hero,
    get_hero,
    get_userSumbissions
}
