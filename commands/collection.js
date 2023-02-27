const dateFormat    = require('dateformat')
const msToTime      = require('pretty-ms')
const _             = require('lodash')
const {firstBy}     = require("thenby")


const {
    byAlias, 
    reset,
    resetNeeds,
    hasResetNeeds,
} = require('../modules/collection')

const {
    formatName,
    mapUserCards,
} = require('../modules/card')

const {
    nameSort,
    numFmt,
} = require('../utils/tools')

const {
    fetchOnly,
    findUserCards,
    getUserCards,
} = require('../modules/user')

const {
    withInteraction,
} = require("../modules/interactions")

const {cmd}         = require('../utils/cmd')
const colors        = require('../utils/colors')


cmd(['collection', 'list'], withInteraction(async (ctx, user, args) => {
    let cols
    if (args.cols.length > 0)
        cols = _.flattenDeep(args.cols)
    else
        cols = byAlias(ctx, ``)

    const completed = args.completed? true: args.completed === false
    const clouted = args.clouted? true: args.clouted === false
    const sort = args.sortComplete? true: args.sortComplete === false

    cols = _.uniqBy(cols, 'id').sort((a, b) => nameSort(a, b, 'id')).filter(x => x)

    if(completed) {
        if(args.completed)
            cols = cols.filter(x => user.completedcols.some(y => y.id === x.id))
        else
            cols = cols.filter(x => !user.completedcols.some(y => y.id === x.id))
    }

    if (clouted) {
        if(args.clouted)
            cols = cols.filter(x => user.cloutedcols.some(y => y.id === x.id))
        else
            cols = cols.filter(x => !user.cloutedcols.some(y => y.id === x.id))
    }

    if(cols.length === 0)
        return ctx.reply(user, `no collections found`, 'red')

    const userCards = await getUserCards(ctx, user)
    const colList = cols.map(x => {
        const clout = user.cloutedcols? user.cloutedcols.find(y => x.id === y.id): null
        const overall = ctx.cards.filter(c => c.col === x.id).length
        const usercount = userCards.filter(c => ctx.cards[c.cardid]?.col === x.id).length
        const rate = Math.ceil((usercount / overall) * 100)
        const cloutCount = clout? clout.amount: 0

        return {
            colName: x.name,
            colID: x.id,
            clouted: cloutCount,
            allCards: overall,
            owned: usercount,
            perc: rate
        }
    })

    if (sort && !args.completed) {
        if (args.sortComplete)
            colList.sort(firstBy((a, b) => b.perc - a.perc).thenBy((c, d) => d.owned - c.owned).thenBy((e, f) => e.colName - f.colName))
        else
            colList.sort(firstBy((a, b) => a.perc - b.perc).thenBy((c, d) => c.owned - d.owned).thenBy((e, f) => e.colName - f.colName))
    }

    const pages = ctx.pgn.getPages(colList.map(x => {
        const cloutStars = x.clouted > 0? `[${x.clouted}${ctx.symbols.star}] `: ''
        const percText = x.perc > 0? x.perc < 1? '(<1%)': `(${x.perc}%)`: ''
        const countText = x.perc >= 100? '': `[${x.owned}/${x.allCards}]`
        return `${cloutStars}**${x.colName}** \`${x.colID}\` ${percText} ${countText}`
    }))

    return ctx.sendPgn(ctx, user, {
        pages,
        buttons: ['back', 'forward'],
        embed: {
            author: { name: `found ${cols.length} collections` }
        }
    })
})).access('dm')

cmd(['collection', 'info'], withInteraction(async (ctx, user, args) => {
    const col = _.flattenDeep(args.cols)[0];

    if(!col)
        return ctx.reply(user, `found 0 collections matching \`${args.colQuery}\``, 'red')

    const colCards = ctx.cards.filter(x => x.col === col.id && x.level < 5)
    const userCards = await findUserCards(ctx, user, colCards.map(x => x.id))
    const card = _.sample(colCards)
    const clout = user.cloutedcols.find(x => x.id === col.id)
    const colInfos = colCards.map(x => ctx.cardInfos[x.id]).filter(x => x)
    const ratingSum = colInfos.reduce((acc, cur) => acc + cur.ratingsum, 0)
    const ratingAvg = ratingSum / colInfos.reduce((acc, cur) => acc + cur.usercount, 0)

    const resp = []
    resp.push(`Overall cards: **${numFmt(colCards.length)}**`)
    resp.push(`You have: **${numFmt(userCards.length)} (${((userCards.length / colCards.length) * 100).toFixed(2)}%)**`)
    resp.push(`Average rating: **${ratingAvg.toFixed(2)}**`)

    const date = new Date(col.dateAdded)
    resp.push(`Added: **${dateFormat(date, "yyyy-mm-dd")}** (${msToTime(new Date() - date, {compact: true})})`)

    if(col.author) {
        var author = await fetchOnly(col.author)

        if (author) {
            resp.push(`Template author: **${author.username}**`)
        }
    }

    if(clout && clout.amount > 0)
        resp.push(`Your clout: **${new Array(clout.amount + 1).join('★')}** (${clout.amount})`)

    resp.push(`Aliases: **${col.aliases.join(" **|** ")}**`)

    if(col.origin) 
        resp.push(`[More information about fandom](${col.origin})`)

    resp.push(`Sample card: ${formatName(card)}`)

    return ctx.send(ctx.interaction, {
        title: col.name,
        image: { url: card.url },
        description: resp.join('\n'),
        color: colors.blue
    }, user.discord_id)
})).access('dm')

cmd(['collection', 'reset'], withInteraction(async (ctx, user, args) => {
    const col = _.flattenDeep(args.cols)[0];

    if(!col)
        return ctx.reply(user, `found 0 collections matching \`${args.colQuery}\``, 'red')


    const legendary = ctx.cards.find(x => x.col === col.id && x.level === 5)
    const colCards = ctx.cards.filter(x => x.col === col.id && x.level < 5)

    const neededForReset = await resetNeeds(ctx, user, colCards)

    const matchingUserCards = await findUserCards(ctx, user, colCards.map(x => x.id))
    const userCards = mapUserCards(ctx, matchingUserCards)
    const hasNeeded = await hasResetNeeds(ctx, userCards, neededForReset)

    let neededBlock = ``
    if (neededForReset[4] > 0)
        neededBlock += `★★★★: **${neededForReset[4]}** ${hasNeeded? '': `- You have **${userCards.filter(x => x.level === 4 && (x.fav? x.amount > 1: x.amount > 0)).length}**`}\n`
    if (neededForReset[3] > 0)
        neededBlock += `★★★: **${neededForReset[3]}** ${hasNeeded? '': `- You have **${userCards.filter(x => x.level === 3 && (x.fav? x.amount > 1: x.amount > 0)).length}**`}\n`
    if (neededForReset[2] > 0)
        neededBlock += `★★: **${neededForReset[2]}** ${hasNeeded? '': `- You have **${userCards.filter(x => x.level === 2 && (x.fav? x.amount > 1: x.amount > 0)).length}**`}\n`
    if (neededForReset[1] > 0)
        neededBlock += `★: **${neededForReset[1]}** ${hasNeeded? '': `- You have **${userCards.filter(x => x.level === 1 && (x.fav? x.amount > 1: x.amount > 0)).length}**`}\n`

    if(!hasNeeded)
        return ctx.reply(user, `you have to have **100%** of the required card rarities to reset collection **${col.name}** (\`${col.id}\`)!
        Unique cards needed for this collection reset are as follows:\n${neededBlock}***This count excludes single cards that are favorited***.`, 'red')

    let question = `Do you really want to reset **${col.name}**?
        This will take at random the following card rarities and amounts:
        ${neededBlock}
        You will get a clout star ${legendary? ' + legendary ticket for resetting this collection' :
        `for resetting this collection\n> Please note that you won't get a legendary card ticket because this collection doesn't have any legendaries`}`

    return ctx.sendCfm(ctx, user, {
        question,
        onConfirm: (x) => reset(ctx, user, col, neededForReset),
    })
}))
