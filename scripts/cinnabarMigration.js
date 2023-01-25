const mongoose      = require('mongoose')
const User          = require('../collections/user')
const UserQuest     = require('../collections/userQuest')
const UserEffect    = require('../collections/userEffect')
const UserInv       = require('../collections/userInventory')
const asdate        = require('add-subtract-date')

const main = async () => {
    const mongoUri = 'mongodb://127.0.0.1:27017/amusement2'
    const mcn = await mongoose.connect(mongoUri)

    await cinnabarTransfer()
}

const cinnabarTransfer = async () => {
    let count = 0
    const users = await User.find()
    let prog = 'O'
    let left = '-'
    const length = users.length
    const next = Math.floor(length / 10)
    for await (const u of users) {
        const curCount = Math.floor(count / next)
        process.stdout.write(`\r[${prog.repeat(curCount)}${left.repeat(10-curCount)}] ${count}/${length}`)

        for (const q of u.dailyquests) {
            const futureExpiry = asdate.add(new Date(), 365, 'days')
            const quest = new UserQuest()
            quest.userid = u.discord_id
            quest.questid = q
            quest.questtype = 'daily'
            quest.expiry = futureExpiry
            await quest.save()
        }

        for (const e of u.effects) {
            const effect = new UserEffect()
            effect.userid = u.discord_id
            effect.id = e.id
            if (e.uses) {
                effect.uses = e.uses
                effect.cooldownends = e.cooldownends
            }
            if (e.expires)
                effect.expires = e.expires
            await effect.save()
        }

        for (const i of u.inventory) {
            const item = new UserInv()
            item.userid = u.discord_id
            item.id = i.id
            item.acquired = i.time
            if (i.cards)
                item.cards = i.cards
            await item.save()
        }

        u.effects = []
        u.inventory = []
        u.dailyquests = []
        u.streaks.votes.topgg = u.votes

        await u.save()
        count++
        process.stdout.write(`\r[${prog.repeat(curCount)}${left.repeat(10-curCount)}] ${count}/${length}`)
    }

}

main()
