const Danbooru  = require('danbooru')

const {
    Tag, 
    Cardinfo
} = require('../collections')

const {
    fetchCardTags,
} = require('./tag')

const booru = new Danbooru()

const getBooruPost = (ctx, booruID) => booru.posts(booruID)

const getPostURL = (post) => booru.url(post.file_url)

const setCardBooruData = async (ctx, cardID, post) => {
    const info = fetchInfo(ctx, cardID)
    info.meta.booruid = post.id
    info.meta.booruscore = post.score
    info.meta.boorurating = post.rating
    info.meta.artist = post.tag_string_artist
    info.meta.pixivid  = post.pixiv_id
    info.meta.source = post.source
    info.meta.image = getPostURL(post)
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

const setCardSource = async (ctx, cardID, source) => {
    const info = fetchInfo(ctx, cardID)
    info.meta.source = source
    await info.save()
}

const setSourcesFromRawData = (ctx, data) => {
    const entrees = data.split('\n')
    const problems = []
    const expr = /\s-\s/
    let count = 0
    entrees.filter(x => x.split(expr).length === 2).map(x => {
        const contents = x.split(expr)
        const cardName = contents[0].trim()
        const link = contents[1].trim()
        const card = ctx.cards.find(c => c.level == cardName[0] && c.name === cardName.substring(2))

        if(!card) {
            problems.push(cardName)
        } else {
            const info = fetchInfo(ctx, card.id)
            if(!info.source) {
                info.meta.source = link
                count++
                info.save()
            }
        }
    })

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
