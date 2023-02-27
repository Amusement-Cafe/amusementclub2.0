const express       = require("express")
const bodyParser    = require("body-parser")
const Topgg         = require('@top-gg/sdk')
const color         = require('../utils/colors')
const _             = require('lodash')
const Vote          = require('../collections/vote')

const {
    formatName,
} = require('./card')

const {
    fetchOnly,
    addUserCards,
} = require('../modules/user')

let listener
let voteCache = []

const listen = (ctx) => {
    const app = express()
    const topggWebhook = new Topgg.Webhook(ctx.dbl.pass)
    app.use(bodyParser.json())
    app.use(bodyParser.urlencoded({ extended: true })); 

    // Webhook handle for https://top.gg/
    app.post("/topgg", topggWebhook.middleware(), (req, res) => {
        const vote = req.vote
        registerTopggVote(ctx, vote)
        res.status(200).end()
    })

    // Webhook handle for https://discordbotlist.com/
    app.post("/dbl", (req, res) => {
        if(req.headers.authorization != ctx.dbl.pass) {
            console.log(`DBL webhook has incorrect auth token ${req.headers.authorization}`)
            res.status(401).end()
            return
        }

        registerDblVote(ctx, req)
        res.status(200).end()
    })

    // Webhook handle for https://ko-fi.com/
    app.post("/kofi", (req, res) => {
        // TODO: add donation handle
        const obj = JSON.parse(req.body.data)
        console.log(obj)
        res.status(200).end()
    })

    app.post("/specials", async (req, res, next) => {
        try {
            const obj = req.body
            let vote = await Vote.findOne({token: obj.token, votedat: {$eq: null}})

            if (!obj.token || !vote) {
                res.status(403).end()
                return
            }

            if (!obj.id) {
                res.status(200).end()
                return
            }

            vote.vote = obj.id
            vote.votedat = new Date()
            await vote.save()
            let cache = voteCache.find(x => x.id == obj.id)

            if (!cache)
                voteCache.push({id: obj.id, count: 1})
            else
                cache.count++

            res.status(200).end()

        } catch (e) {
            return next(e)
        }
    })

    app.get("/votes", async (req, res) => {
        
        let votes = await Vote.aggregate([
            {
                $group: {
                    _id: '$vote',
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    vote: '$_id',
                    count: 1
                }
            }
        ])

        res.status(200).send(votes).end()
    })

    listener = app.listen(ctx.dbl.port, () => console.log(`Listening to webhooks on port ${ctx.dbl.port}`))
}

const registerTopggVote = async (ctx, vote) => {
    var votingUser = await fetchOnly(vote.user)

    if(!votingUser) 
        return

    console.log(`User ${votingUser.username} just voted on top.gg!`)
    votingUser.votes++

    const streak1 = 10 - votingUser.votes % 10
    const streak2 = 100 - votingUser.votes % 100

    let card = _.sample(ctx.cards.filter(y => y.level < 4 
        && !ctx.collections.find(z => z.id === y.col).promo))
    if(votingUser.votes % 100 === 0) {
        card = _.sample(ctx.cards.filter(y => y.col === 'special' && y.level < 5))
    } else if(votingUser.votes % 10 === 0) {
        card = _.sample(ctx.cards.filter(y => y.level < 4 && y.col === _.sample(ctx.collections.filter(z => z.promo)).id))
    }
    let resp = `thank you for voting! You got **${formatName(card)}**\n`

    if (streak2 > 10)
        resp += `Votes until free event card: **${streak1}**\n`

    resp += `Votes until free special card: **${streak2}**`

    await addUserCards(ctx, votingUser, [card.id])
    votingUser.lastvote = new Date()
    votingUser.votenotified = false
    await votingUser.save()

    return ctx.direct(votingUser, {
        image: { url: card.url },
        color: color.blue,
        description: resp
    })
}

const registerDblVote = async (ctx, vote) => {
    // TODO: add streak

    var votingUser = await fetchOnly(vote.body.id)

    if(!votingUser) 
        return

    console.log(`User ${votingUser.username} just voted on dbl!`)
    votingUser.exp += 500
    votingUser.save()

    return ctx.direct(votingUser, {
        color: color.blue,
        description: `thank you for voting! You got **${500}${ctx.symbols.tomato}**`
    })
}

const stopListener = (ctx) => {
    listener.close()
    console.log(`Stopped listening to webhooks on port ${ctx.dbl.port}`)
}

module.exports = {
    listen,
    stopListener,
}
