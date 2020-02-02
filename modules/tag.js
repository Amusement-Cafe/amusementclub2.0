const {Tag} = require('../collections')

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
const withTag = (callback, forceFind = true) => async(ctx, user, ...args) => {
    const c = require('./card')
    const parsedargs = c.parseArgs(ctx, args)

    if(parsedargs.isEmpty(false))
        return ctx.reply(user, `please specify a card`, 'red')

    if(parsedargs.tags.length === 0)
        return ctx.reply(user, `please specify a tag using \`#\` before it`, 'red')

    const cards = c.filter(ctx.cards, parsedargs)
    const card = parsedargs.lastcard? ctx.cards[user.lastcard] : c.bestMatch(cards)

    if(!parsedargs.lastcard && card) {
        user.lastcard = card.id
        await user.save()
    }

    if(!card)
        return ctx.reply(user, `card wasn't found`, 'red')
    
    const tgTag = parsedargs.tags[0]
    const tag = await Tag.findOne({name: tgTag, card: card.id})

    if(forceFind && !tag)
        return ctx.reply(user, `tag #${tgTag} wasn't found for ${c.formatName(card)}`, 'red')

    return callback(ctx, user, card, tag, tgTag)
}

module.exports = {
    fetchTaggedCards,
    fetchCardTags,
    new_tag,
    check_tag,
    withTag,
}
