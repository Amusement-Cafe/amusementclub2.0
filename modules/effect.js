const msToTime  = require('pretty-ms')
const UserSlot = require('../collections/userSlot')

const check_effect = async (ctx, user, id) => {
    if(!user.hero)
        return false

    const effect = ctx.effects.find(x => x.id === id)
    const userEffect = user.effects.find(x => x.id === id)
    const inSlot = await UserSlot.findOne({discord_id: user.discord_id, effect_name: id})
    if(userEffect && userEffect.expires && userEffect.expires < new Date()) {
        if (inSlot) {
            inSlot.effect_name = null
            inSlot.cooldown = null
            await inSlot.save()
        }
        user.effects = user.effects.filter(x => x.id != id)
        user.markModified('effects')
        return false
    }

    if (userEffect && !userEffect.expires && inSlot) {
        inSlot.effect_name = null
        inSlot.cooldown = null
        await inSlot.save()
        return false
    }

    return effect && inSlot && userEffect.expires
}

const formatUserEffect = (ctx, user, x) => {
    if(!x) return '';

    const eff = ctx.effects.find(y => y.id === x.id)
    const lasts = eff.passive && x.expires? msToTime(x.expires - new Date(), { compact: true }) : x.uses
    return `\`${eff.id}\` **${eff.name}** ${lasts? `(${lasts})` : ''}`
}

const mapUserEffects = (ctx, user) => {
    return user.effects.map(x => Object.assign({},
        ctx.items.find(y => y.effectid === x.id),
        ctx.effects.find(y => y.id === x.id),
        x))
}

const withUserEffects = (callback) => async (ctx, user, args) => {
    if(!user.hero)
        return ctx.reply(user, `you don't have a hero yet. You can select hero from the list using \`/hero list\`
            You can search for the hero using \`/hero list hero:hero name\`
            If you cannot find a hero that you want, submit one using \`/hero submit anilist_link:[anilist link](https://anilist.co/)\`
            For more information type \`/help help_menu:hero\``, 'red')

    await Promise.all(user.effects.map(async x => await check_effect(ctx, user, x.id)))
    await user.save()
    const map = await mapUserEffects(ctx, user)
    return callback(ctx, user, map, args)
}



module.exports = {
    check_effect,
    formatUserEffect,
    withUserEffects
}
