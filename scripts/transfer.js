const MongoClient = require('mongodb').MongoClient
const _ = require('lodash')
const fs = require('fs')
const mongoose = require('mongoose')

const User = require('../collections/user')

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
        } catch(e) { console.error(e) }
    })
}

const colsCards = async (db) => {
    console.log(`Processing cards and collections`)
    const cols = await db.collection('collections').find().toArray()
    const cards = await db.collection('cards').find().toArray()
    
    const cardList = [], colList = []
    cols.map(col => {
        const aliases = `[${col.aliases.map(x => `"${x}"`)}]`
        colList.push(`{"id":"${col.id}","name":"${col.name}","origin":${col.origin},"aliases":${aliases},"promo":false,"compressed":${col.compressed}}`)
        cards.filter(y => y.collection === col.id).map(y => {
            cardList.push(`{"name":"${y.name}","level":${y.level},"animated":${y.animated},"col":"${y.collection}"}`)
        })

        fs.writeFileSync(`cols.json`, `[${colList.join(',\n')}]`)
        fs.writeFileSync(`crds.json`, `[${cardList.join(',\n')}]`)
    })
}

const users = async (db) => {
    const usrs = await db.collection('users').find().limit(1).toArray()
    const cards = require('./crds.json')
    //const collections = require('./collections.json')

    usrs.map(async u => {
        console.log(`Processing ${u.username} : ${u.discord_id}...`)
        const newu = await new User()
        newu.joined = u._id.getTimestamp()
        newu.discord_id = u.discord_id
        newu.username = u.username
        newu.exp = u.exp
        newu.ban.embargo = u.embargo
        newu.cards = []
        newu.xp = u.hero.exp || 1

        u.cards.map(c => {
            const id = cards.findIndex(x => x.name === c.name && x.level === c.level && x.col === c.collection)
            console.log(`${id} : ${c.name}`)
            if(id != -1 && !newu.cards.some(x => x.id === id)) {
                newu.cards.push({ 
                    id, 
                    amount: c.amount || 1,
                    obtained: c._id.getTimestamp(),
                    fav: false
                })
            }
        })

        newu.completedcols = u.completedCols.map(x => {id: x.colID, amount: x.timesCompleted})

        u.inventory.map(item => {

        })

        await newu.save()
    })
}

main()
