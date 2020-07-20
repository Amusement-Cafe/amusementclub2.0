const MongoClient   = require('mongodb').MongoClient
const _             = require('lodash')
const fs            = require('fs')
const mongoose      = require('mongoose')
const asdate        = require('add-subtract-date')

const effects       = require('../staticdata/effects')
const items         = require('../staticdata/items')
const User          = require('../collections/user')
const Guild         = require('../collections/guild')
const Cardinfo      = require('../collections/cardinfo')

const main = async () => {
    const mongoUri = 'mongodb://localhost:27017/amusement2'
    const mongoOpt = {useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false}
    const mcn = await mongoose.connect(mongoUri, mongoOpt)

    MongoClient.connect('mongodb://localhost:27017/', mongoOpt, async (err, conn) => {
        if(err)
            console.error(err)

        try {
            const db = conn.db('amusement')
            await colsCards(db)
            await users(db)
            await calcCardInfo(db)
        } catch(e) { console.error(e) }
    })
}

const colsCards = async (db) => {
    console.log(`Processing cards and collections`)
    const cols = await db.collection('collections').find().toArray()
    const cards = await db.collection('cards').find().toArray()
    const promocards = await db.collection('promocards').find().toArray()
    const allcards = cards.concat(promocards)
    
    const now = new Date()
    const cardList = [], colList = []
    cols.map(col => {
        const aliases = `[${col.aliases.map(x => `"${x}"`)}]`
        colList.push(`{"id":"${col.id}","name":"${col.name}","origin":"${col.origin}","aliases":${aliases},"promo":false,"compressed":${col.compressed}}`)
        allcards.filter(y => y.collection === col.id).map(y => {
            if(y.craft)
                cardList.push(`{"name":"${y.name}","level":4,"animated":false,"col":"limitedcraft","added":"${now.toJSON()}"}`)
            else
                cardList.push(`{"name":"${y.name}","level":${y.level},"animated":${y.animated},"col":"${y.collection}","added":"${y._id.getTimestamp().toJSON()}"}`)
        })

        fs.writeFileSync(`cols.json`, `[${colList.join(',\n')}]`)
        fs.writeFileSync(`crds.json`, `[${cardList.join(',\n')}]`)
    })
}

const users = async (db) => {
    const now = new Date();
    const past = asdate.subtract(new Date(), 20, 'hours')
    const cursor = db.collection('users').find()
    const gcursor = db.collection('servers').find()
    //const usrs = await db.collection('users').find().toArray()
    const cards = require('./crds.json')
    const collections = require('./cols.json')

    const oldToNew = {
        cherry_blossoms: 'cherrybloss',
        blue_free_eyes: 'cakeday',
        'long-awaited_date': 'enayano',
        sushi_squad: 'holygrail',
        delightful_sunset: 'claimrecall',
        skies_of_friendship: 'skyfriend',
        the_space_unity: 'spaceunity',
        gift_from_tohru: 'tohrugift',
        onward_to_victory: 'onvictory',
        hazardous_duo: 'pbocchi',
        the_ruler_jeanne: 'rulerjeanne',
        the_judgment_day: 'judgeday' 
    }

    const crafts = {
        cherry_blossoms: ['censored_akari', 'cherry_attacks'],
        blue_free_eyes: ['blue_eyes', 'free_butterfly'],
        'long-awaited_date': ['date_with_ayano', 'kyoko_delight'],
        sushi_squad: ['rolled_sushi_band', 'rolled_sushi_party'],
        delightful_sunset: ['cheery_sunset', 'afterschool_sunset'],
        skies_of_friendship: ['clear_skies', 'dragon_friend'],
        the_space_unity: ['deep_space', 'dragon_unity'],
        gift_from_tohru: ['gift_to_kobayashi', `tohru's_delight`],
        onward_to_victory: ['onward_to_battle', 'sword_of_victory'],
        hazardous_duo: ['diffident_snake', 'sneaky_phoenix'],
        the_ruler_jeanne: ['dark_jeanne', 'light_jeanne'],
        the_judgment_day: ['triggered_angel', 'huge_kaboom', 'trumpet_of_doom']
    }

    cards.map((x, i) => { 
        x.id = i
    })
    //const collections = require('./collections.json')

    let count = 1
    for (let g = await gcursor.next(); g != null; g = await gcursor.next()) {
        console.log(`[#${count}] Processing Guild ${g.id}...`)
        const newg = await new Guild()
        newg.id = g.id
        newg.prefix = g.prefix || '->'
        newg.botchannels = g.botChannels
        newg.xp = 100
        newg.balance = 5000

        if(g.lock)
            newg.overridelock = g.lock

        newg.save()
        count++
    }

    count = 1
    for (let u = await cursor.next(); u != null; u = await cursor.next()) {
        console.log(`[#${count}] Processing ${u.username} : ${u.discord_id}...`)

        if(!u.cards)
            continue

        const newu = await new User()
        newu.ban = { }
        newu.joined = u._id.getTimestamp()
        newu.discord_id = u.discord_id
        newu.username = u.username
        newu.exp = u.exp
        newu.ban.embargo = u.embargo
        newu.cards = []
        newu.lastdaily = past

        if(newu.exp === Infinity)
            newu.exp = 0

        if(u.hero)
            newu.xp = u.hero.exp

        u.cards.map(c => {
            let id = cards.findIndex(x => x.name === c.name.toLowerCase() && x.level === c.level && x.col === c.collection)

            if(c.craft) {
                id = cards.findIndex(x => x.name === c.name.toLowerCase() && x.level === 4)
            }

            if(id != -1 && !newu.cards.some(x => x.id === id)) {
                const ncard = { 
                    id, 
                    amount: c.amount || 1,
                    obtained: now,
                    fav: c.fav
                }

                if(c.rating) {
                    ncard.rating = c.rating
                }
                newu.cards.push(ncard)
            }
        })

        if(u.completedCols)
            newu.completedcols = u.completedCols.map(x => ({id: x.colID, amount: x.timesCompleted, notified: true }))

        if(u.inventory) {
            u.inventory.map(invi => {
                const effect = effects.find(x => x.id === oldToNew[invi.name])
                const item = items.find(x => x.effectid === effect.id)
                const eobject = { id: effect.id }
                if(!effect.passive) { 
                    eobject.uses = item.lasts * 3
                    eobject.cooldownends = new Date()
                }

                newu.effects.push(eobject)

                //console.log(item)
                const cardlist = item.recipe.reduce((arr, x) => {
                    arr.push(_.sample(cards.filter(y => y.level === x 
                        && !collections.find(z => z.id === y.col).promo 
                        && !arr.includes(y.id))).id)
                    return arr
                }, [])
                newu.inventory.push({ id: item.id, cards: cardlist, time: now })
                
                crafts[invi.name].map(x => {
                    const id = cards.findIndex(y => y.name === x && y.level === 4)
                    const existing = newu.cards.find(y => y.id === id)

                    if(existing) {
                        existing.amount++
                    } else {
                       newu.cards.push({ 
                            id, 
                            amount: 1,
                            obtained: now,
                            fav: false
                        }) 
                    }
                })
            })
        }

        await newu.save()
        count++
    }

    console.log("All users processed")
}

const calcCardInfo = async (db) => {
    const carddata = []
    const cards = require('./crds.json')
    const cursor = db.collection('users').find()

    console.log(`Processing users for card info...`)
    let count = 0
    for (let user = await cursor.next(); user != null; user = await cursor.next()) {
        console.log(`[${count}] Filling data from ${user.username}`)
        user.cards.map(card => {
            const i = cards.findIndex(x => x.name === card.name && x.col === card.collection && x.level === card.level)
            if(card.rating) {
                carddata[i] = carddata[i] || { ratingsum: 0, usercount: 0 }
                carddata[i].ratingsum += card.rating
                carddata[i].usercount++
            }
        })
        count++

        //if(count > 1000)
            //break
    }

    count = 0
    console.log(`Extracting card info...`)
    for (let i=0; i<carddata.length; i++) {
        const data = carddata[i]
        if(data) {
            console.log(`[${count}] Processing card ${cards[i].name}`)
            const info = await new Cardinfo()
            info.id = i
            info.ratingsum = data.ratingsum
            info.usercount = data.usercount
            await info.save()
        }
        count++
    }

    console.log(`Global card info done`)
}

main()
