const mongoose      = require('mongoose')
const User          = require('../collections/user')
const UserCard      = require('../collections/userCard')
const UserSlot      = require('../collections/userSlot')
const UserStats     = require('../collections/userstats')

const main = async () => {
    const mongoUri = 'mongodb://localhost:27017/amusement2'
    const mongoOpt = {useNewUrlParser: true, useUnifiedTopology: true}
    const mcn = await mongoose.connect(mongoUri, mongoOpt)

    await bortTransfer()
}

const bortTransfer = async () => {
    let count = 0
    for await (const u of User.find()) {
        console.log(`[#${count}] Processing ${u.username} : ${u.discord_id}...`)

        //Transfer Cards
        const updates = u.cards.map(x => {
            x.userid = u.discord_id
            x.cardid = x.id
            delete x.id

            return { insertOne: { document: x }}
        })

        await UserCard.bulkWrite(updates)

        //Transfer Hero Slots/Effects
        const slots = []
        for (let i = 0; i < 2; i++) {
            const heroSlot = {}
            heroSlot.discord_id = u.discord_id
            heroSlot.hero_id = null
            heroSlot.effect_name = null
            heroSlot.is_active = true
            if(u.hero)
                heroSlot.hero_id = u.hero
            if(u.heroslots[i]) {
                const userEffect = u.effects.find(x => x.id === u.heroslots[i])
                heroSlot.effect_name = userEffect.id
            }
            if(u.herocooldown[i])
                heroSlot.cooldown = u.herocooldown[i]
            slots.push({insertOne: {document: heroSlot}})
        }
        await UserSlot.bulkWrite(slots)

        //Transfer Stats
        const oldStats = u.dailystats
        const newStats = new UserStats()
        newStats.discord_id = u.discord_id
        newStats.username = u.username
        newStats.daily = u.lastdaily
        newStats.claims = oldStats.claims
        newStats.promoclaims = oldStats.promoclaims
        newStats.totalregclaims = oldStats.totalregclaims
        newStats.aucbid = oldStats.bids
        newStats.aucsell = oldStats.aucs
        newStats.liquefy = oldStats.liquify
        newStats.liquefy1 = oldStats.liquify1
        newStats.liquefy2 = oldStats.liquify2
        newStats.liquefy3 = oldStats.liquify3
        newStats.draw = oldStats.draw
        newStats.draw1 = oldStats.draw1
        newStats.draw2 = oldStats.draw2
        newStats.draw3 = oldStats.draw3
        newStats.forge = oldStats.forge
        newStats.forge1 = oldStats.forge1
        newStats.forge2 = oldStats.forge2
        newStats.forge3 = oldStats.forge3
        newStats.tags = oldStats.tags
        newStats.rates = oldStats.rates
        newStats.store3 = oldStats.store3
        await newStats.save()
        u.cards = []
        await u.save()
        console.log(`Finished processing entry #${count}.`)
        count++
    }

}

main()
