const Announcement = require('../collections/announcement')
const User          = require('../collections/user')
const UserSlot      = require('../collections/userSlot')
const UserEffect    = require("../collections/userEffect")

const colors        = require('../utils/colors')
const asdate        = require('add-subtract-date')

const {rct}              = require('../utils/cmd')
const {deleteUserEffect} = require("./effect")

const notifyCheck = async (ctx) => {
    if (ctx.settings.wip)
        return
    await checkAnnounce(ctx)
    await checkDaily(ctx)
    await checkEffect(ctx)
    await checkVote(ctx)
    await checkKofi(ctx)
}

const checkAnnounce = async (ctx) => {
    const lastBotAnnounce = await Announcement
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

    if(!userToDaily) {
        const hasJeanne = await UserSlot.find({effect_name: 'rulerjeanne', is_active: true}).lean()
        if (!hasJeanne)
            return
        const jeanneUsers = hasJeanne.map(x => x.discord_id)
        userToDaily = await User.findOne({
            'prefs.notifications.daily': true,
            'dailynotified': false,
            'lastdaily': { $lt: jeanneTime },
            'discord_id': {$in: jeanneUsers}
        }).sort({ date: -1 })
    }

    if (!userToDaily) return

    await sendNotification(ctx, userToDaily, `Daily Ready!`, `you can claim your daily bonus now with \`/daily\`!`)
    userToDaily.dailynotified = true
    await userToDaily.save()
}

const checkEffect = async (ctx) => {
    let currentTime = new Date()
    let userToNotify
    const expiredEffect = await UserEffect.findOne({expires: {$lt: currentTime}, notified: false})
    if (expiredEffect) {
        userToNotify = await User.findOne({
            'prefs.notifications.effectend': true,
            discord_id: expiredEffect.userid
        })
        if (!userToNotify) {
            return await deleteUserEffect(expiredEffect)
        }
        await sendNotification(ctx, userToNotify, `Effect Expired!`, `your effect \`${expiredEffect.id}\` has expired and has been removed from your hero slot!`)
        return await deleteUserEffect(expiredEffect)
    }
    const cooldownExpired = await UserEffect.findOne({cooldownends: {$lt: currentTime}, notified: false})
    if (!cooldownExpired)
        return
    userToNotify = await User.findOne({
        'prefs.notifications.effectend': true,
        discord_id: cooldownExpired.userid
    })
    if (userToNotify)
        await sendNotification(ctx, userToNotify, `Effect Ready!`, `your effect \`${cooldownExpired.id}\` is now off of cooldown and is ready to be used!`)

    cooldownExpired.notified = true
    await cooldownExpired.save()

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

const checkKofi = async (ctx) => {
    let curTime = new Date()
    const kofiExpiry = await User
        .findOne({
            premium: true,
            premiumExpires: {$lt: curTime}
        })

    if (!kofiExpiry)
        return

    await sendNotification(ctx, kofiExpiry, `Your Amu+ has expired!`, `thank you for your support of Amusement Club!
    Your Amu+ has now expired, if you would like to renew it you can do so through the \`/kofi\` command!`)
    kofiExpiry.premium = false

    await kofiExpiry.save()
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
    return Announcement
        .findOne({ date: { $gt: date } })
        .sort({ date: -1 })
}

rct('title_select', async (ctx, user) => {
    if (ctx.interaction.user.id !== ctx.interaction.message.interaction.user.id)
        return

    user.prefs.profile.title = ctx.interaction.data.values.raw[0]
    await user.save()
    return ctx.interaction.editParent({embeds: [
            {
                description: `**${user.username}**, you have selected a new title! Check it out with \`/profile\``,
                color: colors.green
            }
        ],
    components: []})
})

module.exports = {
    notifyCheck,
    getLastAnnouncement,
}
