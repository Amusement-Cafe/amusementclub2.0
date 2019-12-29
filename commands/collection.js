const {
    byAlias, 
    bestColMatch
} = require('../modules/collection')

const {
    formatName,
    formatLink,
    mapUserCards
} = require('../modules/card')

const {addPagination}       = require('../utils/paginator')
const {cmd}                 = require('../utils/cmd')
const {nameSort}            = require('../utils/tools')
const sample                = require('lodash.sample');

cmd('col', async (ctx, user, ...args) => {
    const filtered = byAlias(ctx, args.join().replace('-', ''))
        .sort((a, b) => nameSort(a, b, 'id'))

    if(filtered.length === 0)
        return ctx.reply(user, `found 0 collections matching \`${args.join(' ')}\``, 'red')

    const pages = []
    filtered.map((x, i) => {
        if (i % 10 == 0) pages.push("")
        pages[Math.floor(i/10)] += `**${x.name}** (${x.id})\n`
    })

    return await addPagination(ctx, user, `found ${filtered.length} collections`, pages)
})

cmd(['col', 'info'], async (ctx, user, ...args) => {
    const col = bestColMatch(ctx, args.join().replace('-', ''));

    if(!col)
        return ctx.reply(user, `found 0 collections matching \`${args.join(' ')}\``, 'red')

    const colCards = ctx.cards.filter(x => x.col === col.id && x.level < 5)
    const userCards = mapUserCards(ctx, user).filter(x => x.col === col.id && x.level < 5)
    const card = sample(colCards)

    const resp = []
    resp.push(`__**${col.name}**__`)
    resp.push(`Overall cards: **${colCards.length}**`)
    resp.push(`You have: **${userCards.length} (${((userCards.length / colCards.length) * 100).toFixed(2)}%)**`)
    resp.push(`Aliases: **${col.aliases.join(" **|** ")}**`)

    if(col.origin) 
        resp.push(`[More information about fandom](${col.origin})`)

    resp.push(`Sample card: ${formatName(card)}`)

    return ctx.send(ctx.msg.channel.id, {
        image: { url: card.url },
        description: resp.join('\n')
    })
})

cmd(['col', 'reset'], async (ctx, user, ...args) => {
    
})