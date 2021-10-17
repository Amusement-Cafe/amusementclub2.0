const UserCard      = require('../collections/userCard')
const MongoClient   = require('mongodb').MongoClient
const mongoose      = require("mongoose")

const main = async () => {
    const mongoUri = 'mongodb://localhost:27017/amusement2'
    const mongoOpt = {useNewUrlParser: true, useUnifiedTopology: true}
    const mcn = await mongoose.connect(mongoUri, mongoOpt)

    MongoClient.connect('mongodb://localhost:27017/', mongoOpt, async (err, conn) => {
        if(err)
            console.error(err)

        try {
            let count = 0
            const db = conn.db('amusement2')
            const cursor = db.collection('users').find()
            for (let u = await cursor.next(); u != null; u = await cursor.next()) {
                console.log(`[#${count}] Processing ${u.username} : ${u.discord_id}...`)

                const updates = u.cards.map(x => {
                    x.userid = u.discord_id
                    x.cardid = x.id
                    delete x.id
                    
                    return { insertOne: { document: x }}
                })
            
                await UserCard.bulkWrite(updates)
                count++
            }
        } catch(e) { console.error(e) }
    })
}

main()
