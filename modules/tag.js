const {Tag}     = require('../collections')
const cardMod   = require('./card')

const fetchTaggedCards = async (tags) => {
    const res = await Tag.find({ name: { $in: tags }})
    return res.filter(x => check_tag(x)).map(x => x.card)
}

const fetchTagNames = async (ctx) => {
    const res = await Tag.find()
    let names = []
    res.map(t => names.indexOf(t.name) == -1 && check_tag(t)? names.push(t.name): t)
    return names.sort()
}

const fetchCardTags = async (card) => {
    const res = await Tag.find({ card: card.id })
    return res.filter(x => check_tag(x))
        .sort((a, b) => (b.upvotes.length - b.downvotes.length) - (a.upvotes.length - a.downvotes.length))
}

const fetchUserTags = async (user) => {
    const res = await Tag.find({ author: user.discord_id })
    return res.filter(x => check_tag(x)).reverse()
}

const new_tag = async (user, name, card) => {
    tag = await new Tag()
    tag.name = name
    tag.author = user.discord_id
    tag.card = card.id
    tag.upvotes = []

    return tag
}

const check_tag = (tag) => {
    return (tag.upvotes.length - tag.downvotes.length > -2) && tag.status === 'clear'
}

const delete_tag = (tag) => Tag.deleteOne({ name: tag.name, card: tag.card })

/**
 * Helper function to enrich the comamnd with selected tag and card
 * @param  {Function} callback command handler
 * @return {Promise}
 */
const withTag = (callback, forceFind = true) => async(ctx, user, ...args) => {
    const parsedargs = cardMod.parseArgs(ctx, args)

    if(parsedargs.isEmpty(false))
        return ctx.qhelp(ctx, user, 'tag')

    if(parsedargs.tags.length === 0)
        return ctx.reply(user, `please specify a tag using \`#\` before it`, 'red')

    let allcards
    if(parsedargs.userQuery) 
        allcards = cardMod.mapUserCards(ctx, user)
    else 
        allcards = ctx.cards.slice()

    const cards = cardMod.filter(allcards, parsedargs)
    const card = parsedargs.lastcard? ctx.cards[user.lastcard] : cardMod.bestMatch(cards)

    if(!parsedargs.lastcard && card) {
        user.lastcard = card.id
        await user.save()
    }

    if(!card)
        return ctx.reply(user, `card wasn't found`, 'red')
    
    const tgTag = parsedargs.tags[0]
    const tag = await Tag.findOne({name: tgTag, card: card.id})

    if(forceFind && !tag)
        return ctx.reply(user, `tag #${tgTag} wasn't found for ${cardMod.formatName(card)}`, 'red')

    return callback(ctx, user, card, tag, tgTag, parsedargs)
}

module.exports = Object.assign(module.exports, {
    fetchTaggedCards,
    fetchCardTags,
    fetchTagNames,
    fetchUserTags,
    new_tag,
    check_tag,
    withTag,
    delete_tag,
})
