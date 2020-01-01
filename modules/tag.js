const {Tag}         = require('../collections')

const fetchTaggedCards = async (tags) => {
    const res = await Tag.find({ name: { $in: tags }})
    return res.map(x => x.card)
}

const fetchCardTags = async (card) => {
    const res = await Tag.find({ card: card.id })
    return res.map(x => x.name)
}

const new_tag = async (user, name, card) => {
    tag = await new Tag()
    tag.name = name
    tag.author = user.discord_id
    tag.card = card.id
    tag.upvotes = []

    return tag
}

module.exports = {
    fetchTaggedCards,
    fetchCardTags,
    new_tag,
}
