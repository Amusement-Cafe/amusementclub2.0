const DBL   = require('dblapi.js')
const _     = require('lodash')

const color = require('../utils/colors')
const {
    formatName,
    addUserCard,
} = require('./card')

const {
    fetchOnly,
} = require('../modules/user')

const connectDBL = (ctx) => {
    const dbl = new DBL(ctx.dbl.token, { webhookPort: ctx.dbl.port, webhookAuth: ctx.dbl.pass }, ctx.bot)

    dbl.on('posted', () => {
        console.log('Server count posted!')
    })

    dbl.on('error', e => {
        console.log(`[DBL] Error occured: ${e}`)
    })

    dbl.webhook.on('ready', hook => {
        console.log(`Webhook running at http://${hook.hostname}:${hook.port}${hook.path}`)
    });

    dbl.webhook.on('vote', async vote => {
        var votingUser = await fetchOnly(vote.user)

        if(!votingUser) 
            return

        console.log(`User ${votingUser.username} just voted!`)
        votingUser.votes++

        const streak1 = 10 - votingUser.votes % 10
        const streak2 = 100 - votingUser.votes % 100

        let card = _.sample(ctx.cards.filter(y => y.level < 4 
            && !ctx.collections.find(z => z.id === y.col).promo))
        if(votingUser.votes % 100 === 0) {
            card = _.sample(ctx.cards.filter(y => y.col === 'special'))
        } else if(votingUser.votes % 10 === 0) {
            card = _.sample(ctx.cards.filter(y => y.level < 4 && y.col === _.sample(ctx.collections.filter(z => z.promo)).id))
        }

        addUserCard(votingUser, card.id)
        votingUser.save()

        return ctx.direct(votingUser, {
            image: { url: card.url },
            color: color.blue,
            description: `thank you for voting! You got **${formatName(card)}**
            Votes until free event card: **${streak1}**
            Votes until free special card: **${streak2}**`
        })
    })
}

module.exports = {
    connectDBL,
}