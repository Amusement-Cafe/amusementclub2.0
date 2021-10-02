const Danbooru  = require('danbooru')

const {
    Tag, 
    Cardinfo
} = require('../collections')

const {
    fetchCardTags,
} = require('./tag')

const {
    urlRegex,
} = require('../utils/tools')

const booru = new Danbooru()

const getBooruPost = (ctx, booruID) => booru.posts(booruID)

const getPostURL = (post) => booru.url(post.file_url)

const setCardBooruData = async (ctx, user, cardID, post) => {
    const info = fetchInfo(ctx, cardID)
    info.meta.booruid = post.id
    info.meta.booruscore = post.score
    info.meta.boorurating = post.rating
    info.meta.artist = post.tag_string_artist
    info.meta.pixivid  = post.pixiv_id
    info.meta.source = post.source
    info.meta.image = getPostURL(post)
    info.meta.contributor = user.discord_id
    await info.save()

    const newTagString = `${post.tag_string_general} ${post.tag_string_character} ${post.tag_string_copyright}`
    const tags = await fetchCardTags(ctx.cards[cardID])
    const newTags = newTagString
        .split(' ')
        .filter(x => !tags.some(y => y.name === x))
        .map(x => ({
            name: x, 
            author: 0,
            card: cardID,
            upvotes: [],
            downvotes: [],
            status: "clear",
        }))
    
    await Tag.insertMany(newTags)
}

const setCardSource = async (ctx, user, cardID, source) => {
    const info = fetchInfo(ctx, cardID)
    info.meta.source = source
    info.meta.contributor = user.discord_id
    await info.save()
}

const setSourcesFromRawData = async (ctx, data, collection, authorID) => {
    const expr = /\s-\s/
    const entrees = data.split('\n').filter(x => x.split(expr).length === 2)
    const problems = []

    let count = 0
    for (let i = 0; i < entrees.length; i++) {
        const x = entrees[i]
        const contents = x.split(expr)
        const cardName = contents[0]
            .trim()
            .toLowerCase()
            .replace(/'|`/g, "")
            .replace(/\s+/g, "_")
        
        const match = x.match(urlRegex)

        if (match) {
            const link = match[0]
            const cards = ctx.cards.filter(
                c => c.level == cardName[0] && 
                c.name === cardName.substring(2) &&
                (!collection || c.col === collection.id))

            if(cards.length == 0 || !link) {
                problems.push(`**No cards found** --- ${cardName} - [link](${link})`)
            } else if (cards.length > 1) {
                problems.push(`**Ambiguous matches** (${cards.map(x => x.col).join(' ')}) --- ${cardName}`)
            } else {
                const info = fetchInfo(ctx, cards[0].id)
                info.meta.source = link
                info.meta.author = authorID
                count++
                await info.save()
            }
        } else {
            problems.push(`**Invalid source link** --- ${x}`)
        }
    }

    return {
        count,
        problems,
    }
}

const fetchInfo = (ctx, id) => {
    let info = ctx.cardInfos[id]
    if(!info) {
        info = new Cardinfo()
        info.id = id
        ctx.cardInfos[id] = info
    }

    return info
}

const fetchAllInfos = async () => await Cardinfo.find()

module.exports = {
    getBooruPost,
    getPostURL,
    setCardBooruData,
    setCardSource,
    fetchInfo,
    fetchAllInfos,
    setSourcesFromRawData,
}
