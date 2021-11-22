const { Expedition } = require('../collections')

const _ = require('lodash')

const { fetchOnly } = require('./user')
const { fetchOrCreateBP } = require('./battle')

const finish_expeditions = async (ctx, now) => {
    const exp = await Expedition.findOne({ finished: false }).sort({ finishes: 1 })
    if(!exp || exp.finishes > now) return;

    const expData = ctx.expeditions[exp.type]
    exp.gain.green = _.sample(expData.green) 
    exp.gain.purple = _.sample(expData.purple) 
    exp.gain.yellow = _.sample(expData.yellow) 
    exp.finished = true
    await exp.save()

    const user = await fetchOnly(exp.user)
    const battleProfile = await fetchOrCreateBP(ctx, user)
    battleProfile.inv.green = exp.gain.green
    battleProfile.inv.purple = exp.gain.purple
    battleProfile.inv.yellow = exp.gain.yellow
    battleProfile.save()

    if (user.prefs.notifications.exp) {
        try {
            return ctx.direct(user, `your expedition has finished. 
            You got ${format_gain(ctx, exp.gain)}
            Check your gems with \`${ctx.prefix}gems\`!`, 'amethyst')
        } catch (e) {}
    }
}

const format_gain = (ctx, gain) => {
    return Object.keys(gain).map(key => `**${gain[key] || 0}** ${ctx.symbols[`${key}_gem`]}`).join(' | ')
}

module.exports = {
    finish_expeditions,
    format_gain,
}
