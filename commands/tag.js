const {cmd}                 = require('../utils/cmd')
const {Tag}                 = require('../collections')
const {addConfirmation}     = require('../utils/confirmator')
const { new_tag }           = require('../modules/tag')
const Filter                = require('bad-words')
const filter                = new Filter();

const {
    formatName,
    withCards,
    withGlobalCards,
    bestMatch
} = require('../modules/card')

cmd('tag', withCards(async (ctx, user, cards, parsedargs) => {
    const card = bestMatch(cards)
    const tgTag = parsedargs.tags[0]
    let tag = await Tag.findOne({name: tgTag, card: card.id})

    if(filter.isProfane(tgTag))
        return ctx.reply(user, `seems like this tag contains excluded words`, 'red')

    if(tag && tag.upvotes.includes(user.discord_id))
        return ctx.reply(user, `you already upvoted this tag`, 'red')

    addConfirmation(ctx, user, `Do you want to ${tag? 'upvote' : 'add'} tag **#${tgTag}** for ${formatName(card)}?`, 
        { confirm: [user.discord_id], decline: [user.discord_id] },
        async (x) => {
            tag = tag || await new_tag(user, tgTag, card)

            console.log(tag)

            tag.downvotes = tag.downvotes.filter(x => x != user.discord_id)
            tag.upvotes.push(user.discord_id)
            await tag.save()

            return ctx.reply(user, `confirmed tag **#${tgTag}** for ${formatName(card)}`)
        }, async (x) => {
            return ctx.reply(user, `tag ${tag? 'upvote' : 'adding'} was declined`, 'red')
        })
}, true))
