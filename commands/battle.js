const msToTime  = require('pretty-ms')

const { 
    fetchOrCreateBP,
    fetchOrCreateCardStats,
    fetchCardStats,
    formatStats,
    sortStats,
} = require('../modules/battle')

const {
    cap,
    LEVELtoNRG,
    numFmt,
    escapeRegex,
} = require('../utils/tools')

const { format_gain } = require('../modules/expedition')
const { cmd } = require('../utils/cmd')

const _ = require('lodash')

const {
    formatName,
    addUserCard,
    withCards,
    withGlobalCards,
    bestMatch,
} = require('../modules/card')

const colors = require('../utils/colors')

cmd(['gems'], async (ctx, user, ...args) => {
    const battleProfile = await fetchOrCreateBP(ctx, user)
    return ctx.reply(user, `you have ${format_gain(ctx, battleProfile.inv)}`, 'amethyst')
}).access('dm')

cmd(['card', 'upgrade'], ['cd', 'up'], withCards(async (ctx, user, cards, parsedargs) => {
    const card = bestMatch(cards.filter(x => x.col === ctx.battleCol))
    if(!card) {
        return ctx.reply(user, `please specify card from collection \`${ctx.battleCol}\`!
            You can use \`${ctx.prefix}cards -battle\` to see your cards eligible for the battle.`, 'red')
    }

    const cardStats = await fetchOrCreateCardStats(ctx, user, card)
    if (cardStats.level >= 10) {
        return ctx.reply(user, `card ${formatName(card)} is already max level!`, 'red')
    }

    const key = _.sample(Object.keys(cardStats.toObject().stats))
    cardStats.stats[key]++
    cardStats.level++
    await cardStats.save()

    const name = `[${cap(card.name.replace(/_/g, ' '))}](${card.shorturl})`
    return ctx.reply(user, `upgraded ${ctx.symbols[key]} **${key}** of ${name} to **${cardStats.stats[key]}**.
        Card level: **${cardStats.level}/10**.
        New card stats: ${formatStats(ctx, cardStats).join(' | ')} \n
        Use \`${ctx.prefix}battle cards\` to view your battle cards.`, 'amethyst')
})).access('dm')

cmd(['battle', 'cards'], ['btl', 'cd'], withCards(async (ctx, user, cards, parsedargs) => {
    const cardStats = await fetchCardStats(ctx, user, cards.filter(x => x.col === ctx.battleCol).map(x => x.id))

    if (cardStats.length === 0) {
        return ctx.reply(user, `no battle cards found. To create a battle card, use \`${ctx.prefix}card upgrade [card]\``, 'red')
    }

    if (parsedargs.battleSort) {
        sortStats(ctx, cardStats, parsedargs)
    }

    const formatted = cardStats.map(x => {
        const card = ctx.cards[x.card_id]
        const name = `[${cap(card.name.replace(/_/g, ' '))}](${card.shorturl})`
        return `[${ctx.symbols.energy} **${LEVELtoNRG(x.level)}**] - ${formatStats(ctx, x).join(' | ')} - ${name}`
    })

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(formatted, 10),
        embed: { 
            author: { name: `${user.username}, your battle cards (${numFmt(cardStats.length)} results)` },
            color: colors.amethyst,
        }
    })
})).access('dm')
