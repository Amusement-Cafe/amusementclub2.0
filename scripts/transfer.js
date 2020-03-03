const MongoClient = require('mongodb').MongoClient
const _ = require('lodash')
const fs = require('fs')

const main = () => {
    MongoClient.connect('mongodb://localhost:27017/', async (err, conn) => { try{
        if(err)
            console.error(err)

        const db = conn.db('amusement')
        const cols = _.sampleSize(await db.collection('collections').find({special: false}).toArray(), 10)
        const cards = await db.collection('cards').find({col: {$in:cols.map(x => x.id)}}).toArray()
        
        const cardList = [], colList = []
        cols.map(col => {
            const aliases = `[${col.aliases.map(x => `"${x}"`)}]`
            colList.push(`{"id":"${col.id}","name":"${col.name}","origin":${col.origin},"aliases":${aliases},"promo":false,"compressed":${col.compressed}}`)
            _.sampleSize(cards.filter(y => y.col === col.id), 50).map(y => {
                cardList.push(`{"name":"${y.name}","level":${y.level},"animated":${y.animated},"col":"${y.col}"}`)
            })

            fs.writeFileSync(`cols.json`, colList.join(',\n'))
            fs.writeFileSync(`crds.json`, cardList.join(',\n'))
        })
        } catch(e) { console.error(e) }
    })
    
}

main()
