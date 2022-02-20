const msToTime  = require('pretty-ms')

const check_effect = (ctx, user, id) => {
    if(!user.hero)
        return false

    const effect = ctx.effects.find(x => x.id === id)
    const userEffect = user.effects.find(x => x.id === id)
    if(userEffect && userEffect.expires && userEffect.expires < new Date()) {
        user.heroslots = user.heroslots.filter(x => x != id)
        user.effects = user.effects.filter(x => x.id != id)
        user.markModified('heroslots')
        user.markModified('effects')
        return false
    }

    return effect && user.heroslots.some(x => x === id) && userEffect.expires
}

const formatUserEffect = (ctx, user, x) => {
    if(!x) return '';

    const eff = ctx.effects.find(y => y.id === x.id)
    const lasts = eff.passive && x.expires? msToTime(x.expires - new Date(), { compact: true }) : x.uses
    return `\`${eff.id}\` **${eff.name}** ${lasts? `(${lasts})` : ''}`
}

const mapUserEffects = (ctx, user) => {
    user.effects.map(x => check_effect(ctx, user, x.id))
    return user.effects.map(x => Object.assign({},
        ctx.items.find(y => y.effectid === x.id),
        ctx.effects.find(y => y.id === x.id),
        x))
}

const withUserEffects = (callback) => (ctx, user, args) => {
    if(!user.hero)
        return ctx.reply(user, `you don't have a hero yet. You can select hero from the list using \`->hero list\`
            You can search for the hero using \`->hero list [hero name]\`
            If you cannot find a hero that you want, submit one using \`->hero submit [anilist link](https://anilist.co/)\`
            For more information type \`->help hero -here\``, 'red')

    const map = mapUserEffects(ctx, user)
    return callback(ctx, user, map, args)
}

module.exports = {
    check_effect,
    formatUserEffect,
    withUserEffects
}
