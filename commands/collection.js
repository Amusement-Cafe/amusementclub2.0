const {
    byAlias, 
    bestColMatch,
    reset
} = require('../modules/collection')

const {
    formatName,
    mapUserCards
} = require('../modules/card')

const {addPagination}       = require('../utils/paginator')
const {addConfirmation}     = require('../utils/confirmator')
const {cmd}                 = require('../utils/cmd')
const {nameSort}            = require('../utils/tools')
const _                     = require('lodash')

cmd('col', async (ctx, user, ...args) => {
    const completed = args.filter(x => x === '-completed' || x === '!completed')[0]
    args = args.filter(x => x != '-completed' && x != '!completed')

    let cols = byAlias(ctx, args.join().replace('-', ''))
        .sort((a, b) => nameSort(a, b, 'id'))

    if(completed) {
        if(completed[0] === '-') 
            cols = cols.filter(x => user.completedcols.some(y => y.id === x.id))
        else
            cols = cols.filter(x => !user.completedcols.some(y => y.id === x.id))
    }

    if(cols.length === 0)
        return ctx.reply(user, `no collections found`, 'red')

    const pages = []
    cols.map((x, i) => {
        if (i % 10 == 0) pages.push("")
        const complete = user.completedcols.filter(y => x.id === y.id)[0]
        pages[Math.floor(i/10)] += `${complete? `[${complete.amount}${ctx.symbols.star}]` : ''} **${x.name}** (${x.id})\n`
    })

    return await addPagination(ctx, user, `found ${cols.length} collections`, pages)
})

cmd(['col', 'info'], async (ctx, user, ...args) => {
    const col = bestColMatch(ctx, args.join().replace('-', ''));

    if(!col)
        return ctx.reply(user, `found 0 collections matching \`${args.join(' ')}\``, 'red')

    const colCards = ctx.cards.filter(x => x.col === col.id && x.level < 5)
    const userCards = mapUserCards(ctx, user).filter(x => x.col === col.id && x.level < 5)
    const card = _.sample(colCards)
    const clout = user.completedcols.filter(x => x.id === col.id)[0]

    const resp = []
    resp.push(`Overall cards: **${colCards.length}**`)
    resp.push(`You have: **${userCards.length} (${((userCards.length / colCards.length) * 100).toFixed(2)}%)**`)

    if(clout)
        resp.push(`Your clout: **${new Array(clout.amount + 1).join('★')}** (${clout.amount})`)

    resp.push(`Aliases: **${col.aliases.join(" **|** ")}**`)

    if(col.origin) 
        resp.push(`[More information about fandom](${col.origin})`)

    resp.push(`Sample card: ${formatName(card)}`)

    return ctx.send(ctx.msg.channel.id, {
        title: col.name,
        image: { url: card.url },
        description: resp.join('\n')
    }, user.discord_id)
})

cmd(['col', 'reset'], async (ctx, user, ...args) => {
    const col = bestColMatch(ctx, args.join().replace('-', ''));

    if(!col)
        return ctx.reply(user, `found 0 collections matching \`${args.join(' ')}\``, 'red')

    const legendary = ctx.cards.filter(x => x.col === col.id && x.level === 5)[0]
    const colCards = ctx.cards.filter(x => x.col === col.id && x.level < 5)
    let userCards = mapUserCards(ctx, user).filter(x => x.col === col.id && x.level < 5)

    if(userCards.length < colCards.length)
        return ctx.reply(user, `you have to have **100%** of the cards from collection (excluding legendaries) in order to reset it`, 'red')

    addConfirmation(ctx, user, `Do you really want to reset **${col.name}**?
        You will lose 1 copy of each card from that collection and gain 1 clout star${legendary? '+ legendary' : 
        `\n> Please note that you won't get legendary card ticket because this collection doesn't have any legendaries` }`, null, 
        (x) => reset(ctx, user, col),
        (x) => ctx.reply(user, `collection reset has been declined`, 'red'))
})