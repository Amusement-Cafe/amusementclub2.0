const {Tag}         = require('../collections')

const fetchTaggedCards = async (tags) => {
    const res = await Tag.find({ name: { $in: tags }})
    return res.map(x => x.card)
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
    new_tag,
}
