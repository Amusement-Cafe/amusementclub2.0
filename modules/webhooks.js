const color         = require('../utils/colors')
const Kofi          = require('../collections/kofi')
const _             = require('lodash')

const {
    formatName,
} = require('./card')

const {
    fetchOnly,
    addUserCards,
} = require('../modules/user')

const registerTopggVote = async (ctx, vote) => {
    let votingUser = await fetchOnly(vote.user)

    if(!votingUser) 
        return

    console.log(`User ${votingUser.username} just voted on top.gg!`)
    votingUser.streaks.votes.topgg++

    const streak1 = 10 - votingUser.streaks.votes.topgg % 10
    const streak2 = 100 - votingUser.streaks.votes.topgg % 100

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
    let votingUser = await fetchOnly(vote)

    if(!votingUser)
        return

    const streak1 = 10 - votingUser.streaks.votes.dbl % 10
    const streak2 = 100 - votingUser.streaks.votes.dbl % 100

    let reward = 500

    if (votingUser.streaks.votes.dbl % 100 === 0)
        reward += 4500
    else if (votingUser.streaks.votes.dbl % 10 === 0)
        reward += 500

    console.log(`User ${votingUser.username} just voted on dbl!`)
    votingUser.streaks.votes.dbl++
    votingUser.exp += reward
    votingUser.save()

    let resp = `thank you for voting! You got **${reward}${ctx.symbols.tomato}**\n`

    if (streak2 > 10)
        resp += `Votes until a 2x bonus: **${streak1}**\n`

    resp += `Votes until a 10x bonus: **${streak2}**`

    return ctx.direct(votingUser, {
        color: color.blue,
        description: resp
    })
}

const registerKofiPayment = async (ctx, kofiResp) => {
    const newKofi = new Kofi()
    newKofi.type = kofiResp.type
    newKofi.url = kofiResp.url
    newKofi.transaction_id = kofiResp.kofi_transaction_id
    newKofi.amount = kofiResp.amount
    newKofi.timestamp = kofiResp.timestamp
    await newKofi.save()
}

module.exports = {
    registerDblVote,
    registerKofiPayment,
    registerTopggVote,
}
