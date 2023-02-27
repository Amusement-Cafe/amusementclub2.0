const mongoose      = require('mongoose')
const Guild         = require('../collections/guild')
const GuildUser     = require('../collections/guildUser')
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
    const guilds = await Guild.find()
    let prog = 'O'
    let left = '-'
    const length = guilds.length
    const next = Math.floor(length / 10)

    for await (g of guilds) {
        const curCount = Math.floor(count / next)
        process.stdout.write(`\r[${prog.repeat(curCount)}${left.repeat(10-curCount)}] ${count}/${length}`)

        for (const u of g.userstats) {
            const gUser = new GuildUser()
            gUser.userid = u.id
            gUser.guildid = g.id
            gUser.xp = u.xp
            gUser.level = u.rank
            gUser.roles = u.roles
            await gUser.save()
        }

        count++
        process.stdout.write(`\r[${prog.repeat(curCount)}${left.repeat(10-curCount)}] ${count}/${length}`)
    }
    process.stdout.write('\n')
    process.exit()


}

main()
