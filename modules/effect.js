const msToTime  = require('pretty-ms')

const check_effect = (ctx, user, id) => {
    if(!user.hero)
        return false

    const effect = ctx.effects.find(x => x.id === id)
    return effect && user.heroslots.some(x => x === id) && effect.check(ctx, user)
}

const formatUserEffect = (ctx, user, x) => {
    if(!x) return '';

    const eff = ctx.effects.find(y => y.id === x.id)
    const lasts = eff.passive? msToTime(x.expires - new Date(), { compact: true }) : x.uses
    return `\`${eff.id}\` **${eff.name}** (${lasts})`
}

const mapUserEffects = (ctx, user) => user.effects.map(x => Object.assign({}, ctx.effects.find(y => y.id === x.id), x))

const withUserEffects = (callback) => (ctx, user, ...args) => {
    if(!user.hero)
        return ctx.reply(user, `you have to have a hero to use hero effects`, 'red')

    const map = mapUserEffects(ctx, user)
    return callback(ctx, user, map, ...args)
}

module.exports = {
    check_effect,
    formatUserEffect,
    withUserEffects
}
