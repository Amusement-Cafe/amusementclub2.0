const _             = require('lodash')
const https         = require('https')
const msToTime      = require('pretty-ms')
const dateFormat    = require('dateformat')

const colors        = require('../utils/colors')
const {cmd, pcmd}   = require('../utils/cmd')

const {
    fetchCardTags,
} = require('../modules/tag')

const {
    bestColMatch,
} = require('../modules/collection')

const {
    evalCard, 
} = require('../modules/eval')

const {
    getBooruPost, 
    getPostURL,
    setCardBooruData,
    setCardSource,
    fetchInfo,
    setSourcesFromRawData,
} = require('../modules/meta')

const {
    formatName,
    withGlobalCards,
    bestMatch,
} = require('../modules/card')

cmd('info', ['card', 'info'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'info')

    const card = bestMatch(cards)
    const price = await evalCard(ctx, card)
    const tags = await fetchCardTags(card)
    const col = bestColMatch(ctx, card.col)

    const resp = []
    const extrainfo = fetchInfo(ctx, card.id)
    const usercard = user.cards.find(x => x.id === card.id)
    const embed = { color: colors.blue, fields: [] }


    resp.push(formatName(card))
    resp.push(`Fandom: **${col.name}**`)
    resp.push(`Price: **${price}** ${ctx.symbols.tomato}`)

    if(extrainfo.ratingsum > 0)
        resp.push(`Average Rating: **${(extrainfo.ratingsum / extrainfo.usercount).toFixed(2)}**`)

    if(usercard && usercard.rating)
        resp.push(`Your Rating: **${usercard.rating}**`)

    if(card.added)
        resp.push(`Added: **${dateFormat(card.added, "yyyy-mm-dd")}** (${msToTime(new Date() - card.added, {compact: true})})`)

    if (extrainfo.ownercount > 0)
        resp.push(`Owner Count: **${extrainfo.ownercount}**`)

    resp.push(`ID: ${card.id}`)
    embed.description = resp.join('\n')

    if(extrainfo.meta.booruid) {
        const meta = []
        meta.push(`Rating: **${extrainfo.meta.boorurating}**`)
        meta.push(`Artist: **${extrainfo.meta.artist}**`)
        meta.push(`[Danbooru page](https://danbooru.donmai.us/posts/${extrainfo.meta.booruid})`)  
 
        embed.fields.push({
            name: `Metadata`, 
            value: meta.join('\n'),
            inline: true,
        })
    }

    if(tags && tags.length > 0) {
        embed.fields.push({
            name: `Tags`, 
            value: `#${tags.slice(0, 3).map(x => x.name).join('\n#')}`,
            inline: true,
        })
    }
    
    if(extrainfo.meta.source) {
        const sourceList = []
        sourceList.push(`[Image origin](${extrainfo.meta.source})`)

        if(extrainfo.meta.image)
            sourceList.push(`[Source image](${extrainfo.meta.image})`)

        embed.fields.push({
            name: `Sources`, 
            value: sourceList.join('\n'),
        })
    }

    return ctx.send(ctx.msg.channel.id, embed, user.discord_id)

})).access('dm')

pcmd(['admin', 'mod', 'metamod'], ['meta', 'set', 'booru'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const booruID = parsedargs.extra[0]
    if(isNaN(booruID)) {
        return ctx.reply(user, `booru ID should be a number and specified as \`:1234567\``, 'red')
    }

    const post = await getBooruPost(ctx, booruID)
    if(!post) {
        return ctx.reply(user, `cannot find post with ID ${booruID}`, 'red')
    }

    const properties = []
    post.source = post.pixiv_id? `https://www.pixiv.net/en/artworks/${post.pixiv_id}` : post.source

    properties.push(`Source: ${post.source}`)
    properties.push(`Artist: **${post.tag_string_artist}**`)
    properties.push(`Characters: **${post.tag_count_character}**`)
    properties.push(`Copyrights: **${post.tag_count_copyright}**`)
    properties.push(`Tags: **${post.tag_count_general}**`)
    properties.push(`Pixiv ID: **${post.pixiv_id}**`)

    const card = bestMatch(cards)
    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question: `Do you want to add this booru source to ${formatName(card)}?
            This will add the following properties to the card metadata`,
        embed: { 
            fields: [
                {
                    name: "Properties", 
                    value: properties.join('\n'),
                }
            ],
            footer: { text: `Booru ID: ${booruID}` },
            image: { url: getPostURL(post) }
        },
        onConfirm: async (x) => {
            try {
                await setCardBooruData(ctx, card.id, post)
                return ctx.reply(user, `sources and tags have been saved!`)

            } catch(e) {
                return ctx.reply(user, `unexpected error occured while trying to add card booru data. Please try again.
                    ${e.message}`, 'red')
            }
        },
    })
}))

pcmd(['admin', 'mod', 'metamod'], ['meta', 'set', 'source'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const url = parsedargs.extra[0]
    if(!url) {
        return ctx.reply(user, `please specify the url to the card source as \`:https://www.pixiv.net/en/artworks/80848641\``, 'red')
    }

    const card = bestMatch(cards)
    await setCardSource(ctx, card.id, url)

    return ctx.reply(user, `successfully set source image for ${formatName(card)}`)
}))

pcmd(['admin', 'mod', 'metamod'], ['meta', 'scan', 'source'], async (ctx, user, ...args) => {
    https.get(ctx.msg.attachments[0].url, res => {
        res.setEncoding('utf8')

        let rawData = ''
        res.on('data', (chunk) => { rawData += chunk })
        res.on('end', () => {
            try {
                const res = setSourcesFromRawData(ctx, rawData)
                if(res.problems.length > 0) {
                    ctx.reply(user, `following cards were not found:
                        ${res.problems.join('\n')}`, 'yellow')
                }

                return ctx.reply(user, `successfully set sources for **${res.count}** cards`)

            } catch (e) {
                return ctx.reply(user, `an error occured while scanning the sources:
                    ${e.message}`, 'red')
            }
        });
    })
})
