const Annmouncement = require('../collections/announcement')
const User          = require('../collections/user')

const colors        = require('../utils/colors')
const asdate        = require('add-subtract-date')

const notifyCheck = async (ctx) => {
    await checkAnnounce(ctx)
    await checkDaily(ctx)
    await checkVote(ctx)
}

const checkAnnounce = async (ctx) => {
    const lastBotAnnounce = await Annmouncement
        .findOne({ notify: true })
        .sort({ date: -1 })

    if(!lastBotAnnounce) return

    const userToAnnounce = await User.findOne({ 
        'prefs.notifications.announce': true,
        'lastannounce': { $lt: lastBotAnnounce.date },
    })

    if(!userToAnnounce) return
    userToAnnounce.lastannounce = lastBotAnnounce.date

    await sendNotification(ctx, userToAnnounce, lastBotAnnounce.title, lastBotAnnounce.body)
    await userToAnnounce.save()
}

const checkDaily = async (ctx) => {
    let dailyTime = new Date()
    dailyTime = asdate.subtract(dailyTime, 20, 'hours')
    let jeanneTime = new Date()
    jeanneTime = asdate.subtract(jeanneTime, 17, 'hours')

    let userToDaily = await User
        .findOne({ 
            'prefs.notifications.daily': true,
            'dailynotified': false,
            'lastdaily': { $lt: dailyTime },
        })
        .sort({ date: -1 })

    if(!userToDaily)
        userToDaily = await User.findOne({
            'prefs.notifications.daily': true,
            'dailynotified': false,
            'lastdaily': { $lt: jeanneTime },
        }).sort({ date: -1 })

    if (!userToDaily) return

    await sendNotification(ctx, userToDaily, `Your daily is ready`, `you can claim your daily bonus now with \`/daily\`!`)
    userToDaily.dailynotified = true
    await userToDaily.save()
}

const checkVote = async (ctx) => {
    let voteTime = new Date()
    voteTime = asdate.subtract(voteTime, 12, 'hours')

    const userToVote = await User
        .findOne({ 
            'prefs.notifications.vote': true,
            'votenotified': false,
            'lastvote': { $lt: voteTime },
        })
        .sort({ date: -1 })

    if(!userToVote) return

    await sendNotification(ctx, userToVote, `Time to vote!`, `get rewards by voting for the Amusement Club.
        Use \`/vote\` to get a list of sites where you can vote!`)

    userToVote.votenotified = true
    await userToVote.save()
}

const sendNotification = async (ctx, user, title, body) => {
    try {
        await ctx.direct(user, { 
            author: { name: title },
            description: body,
        }, 'blue')
    } catch(e) {
        //TODO something means user has disabled DMs
    }
}

const getLastAnnouncement = (ctx, user) => {
    const date = user.lastannounce || new Date(0)
    return Annmouncement
        .findOne({ date: { $gt: date } })
        .sort({ date: -1 })
}

module.exports = {
    notifyCheck,
    getLastAnnouncement,
}
