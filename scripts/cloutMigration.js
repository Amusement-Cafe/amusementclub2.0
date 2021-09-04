const User          = require('../collections/user')
const cards         = require('../../ayano/data/cards.json')
const mongoose      = require("mongoose");


const main = async () => {
    const mongoUri = 'mongodb://localhost:27017/amusement2'
    const mongoOpt = {useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false}
    const mcn = await mongoose.connect(mongoUri, mongoOpt)

    await cloutTransfer()
    await buildingRemoval()
}

const cloutTransfer = async () => {
    let hasComplete = await User.find({completedcols: {$exists: true, $ne: []}})
    await hasComplete.map(async (x, i) => {
        console.log(`Processing User ${i+1}/${hasComplete.length} for clout migration`)
        let toFilter = []

        x.completedcols.map(c => {
            const colCards = cards.filter(x => x.col === c.id && x.level < 5)
            const userCards = x.cards.filter(x => x.id < cards.length).map(x => Object.assign({}, cards[x.id], x)).filter(x => x.col === c.id && x.level < 5)
            if (userCards.length < colCards.length)
                toFilter.push(c.id)
            if (c.amount > 0){
                x.cloutedcols.push({id: c.id, amount: c.amount})
                c.amount = 0
            }
        })
        if (toFilter.length > 0){
            x.completedcols = x.completedcols.filter(y => !toFilter.some(z => y.id === z))
        }
        await x.save()

        console.log(`Finished Processing User ${i + 1}/${hasComplete.length} for clout migration`)
    })
}

const buildingRemoval = async () => {
    let hasInv = await User.find({inventory: {$exists: true, $ne: []}})
    const removalBuildings = ["auchouse", "heroq", "tavern", "smithhub", "gbank"]
    const reimbursement = {
        "tavern": 1500,
        "auchouse": 500,
        "heroq": 2500,
        "smithhub": 3000,
        "gbank": 2500
    }
    await hasInv.map(async (x, i) => {
        console.log(`Processing User ${i+1}/${hasInv.length} for building removal`)

        let toFilter = []
        x.inventory.map(y => {
            if (removalBuildings.some(z=> z === y.id)) {
                x.exp += reimbursement[y.id]
                toFilter.push(y.id)
            }
        })
        if (toFilter.length > 0)
            x.inventory = x.inventory.filter(f => !toFilter.some(s => f.id === s))
        await x.save()
        console.log(`Finished Processing User ${i + 1}/${hasInv.length} for building removal`)

    })
}

main()
