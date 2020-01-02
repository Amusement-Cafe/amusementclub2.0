const {Tag} = require('../collections')

const {
    formatName,
    bestMatch,
    filter,
    parseArgs,
} = require('./card')

const fetchTaggedCards = async (tags) => {
    const res = await Tag.find({ name: { $in: tags }})
    return res.filter(x => check_tag(x)).map(x => x.card)
}

const fetchCardTags = async (card) => {
    const res = await Tag.find({ card: card.id })
    return res.filter(x => check_tag(x)).map(x => x.name)
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

/**
 * Helper function to enrich the comamnd with selected tag and card
 * @param  {Function} callback command handler
 * @return {Promise}
 */
const withTag = (callback) => async(ctx, user, ...args) => {
    const c = require('./card')
    const parsedargs = c.parseArgs(ctx, args)
    const cards = c.filter(ctx.cards, parsedargs)
    const card = c.bestMatch(cards)

    if(cards.length == 0)
        return ctx.reply(user, `card ${c.formatName(card)} wasn't found`, 'red')
    
    const tgTag = parsedargs.tags[0]
    const tag = await Tag.findOne({name: tgTag, card: card.id})

    return callback(ctx, user, card, tag, tgTag)
}

module.exports = {
    fetchTaggedCards,
    fetchCardTags,
    new_tag,
    check_tag,
    withTag,
}
