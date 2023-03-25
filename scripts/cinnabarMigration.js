const mongoose      = require('mongoose')
const asdate        = require('add-subtract-date')

const {
    User,
    UserQuest,
    UserEffect,
    UserInventory,
    Cardinfo,
    GuildUser,
    GuildBuilding,
    Guild
} = require('../collections')
const main = async () => {
    const mongoUri = 'mongodb://127.0.0.1:27017/amusement2'
    const mcn = await mongoose.connect(mongoUri)

    await cinnabarTransfer()
}

const cinnabarTransfer = async () => {
    let count = 0
    let prog = 'O'
    let left = '-'

    const futureExpiry = asdate.add(new Date(), 1, 'days')
    const users = await User.find()
    const length = users.length
    const next = Math.floor(length / 10)
    for await (const u of users) {
        const curCount = Math.floor(count / next)
        process.stdout.write(`\r[${prog.repeat(curCount)}${left.repeat(10-curCount)}] ${count}/${length}`)

        for (const q of u.dailyquests) {
            const quest = new UserQuest()
            quest.userid = u.discord_id
            quest.questid = q
            quest.type = 'daily'
            quest.expiry = futureExpiry
            quest.completed = false
            quest.created = new Date()
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
            const item = new UserInventory()
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
        u.prefs.profile = {
            bio: 'This user has not set a bio',
            card: '',
            color: '16756480',
            favclout: '',
            favcomplete: '',
            title: ''
        }
        u.premium = false


        await u.save()
        count++
        process.stdout.write(`\r[${prog.repeat(curCount)}${left.repeat(10-curCount)}] ${count}/${length}`)
    }

    const cards = await Cardinfo.find()
    for await (const c of cards) {
        if (c.meta.added)
            continue
        c.meta.added = c._id.getTimestamp()
        await c.save()
    }

    const replacements = {
        castle: {
            id: "pampercentral",
            maxLevel: 4
        },
        heroq: {
            id: "lemonadestand",
            maxLevel: 5
        },
        auchouse: {
            id: "discountcenter",
            maxLevel: 4
        },
        smithhub: {
            id: "processingplant",
            maxLevel: 4
        },
        gbank: {
            id: "arcadecenter",
            maxLevel: 3
        },
        tavern: {
            id: "pachinkohall",
            maxLevel: 2
        }
    }

    const guilds = await Guild.find()
    for await (g of guilds) {
        for (const u of g.userstats) {
            const gUser = new GuildUser()
            gUser.userid = u.id
            gUser.guildid = g.id
            gUser.xp = u.xp
            gUser.level = u.rank
            gUser.roles = u.roles
            await gUser.save()
        }

        for (const b of g.buildings) {
            let replacement = replacements[b.id]
            const newBuilding = new GuildBuilding()
            newBuilding.guildid = g.id
            newBuilding.id = replacement.id
            newBuilding.level = b.level > replacement.maxLevel? replacement.maxLevel: b.level
            newBuilding.health = 100
            await newBuilding.save()
        }
        g.buildings = []
        await g.save()

        count++
    }
    process.exit()
}

main()
