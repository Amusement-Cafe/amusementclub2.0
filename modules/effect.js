
const check_effect = (ctx, user, id) => {
    if(!user.hero)
        return false

    const effect = ctx.effects.filter(x => x.id === id)
    return effect && user.heroslots.some(x => x.id === id) && effect.check(ctx, user)
}

module.exports = {
    check_effect
}
