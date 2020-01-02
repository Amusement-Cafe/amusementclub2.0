const {cmd, pcmd}           = require('../utils/cmd')
const {Tag}                 = require('../collections')
const {addConfirmation}     = require('../utils/confirmator')
const Filter                = require('bad-words')
const filter                = new Filter();

const {
    fetchOnly
} = require('../modules/user')

const { 
    new_tag,
    check_tag,
    withTag
} = require('../modules/tag')

const {
    formatName,
    withCards,
    withGlobalCards,
    bestMatch
} = require('../modules/card')

cmd('tag', withTag(async (ctx, user, card, tag, tgTag) => {
    if(user.ban && user.ban.tags > 2)
        return ctx.reply(user, `you were banned from adding tags. To address this issue use \`->help support\``, 'red')

    if(filter.isProfane(tgTag))
        return ctx.reply(user, `your tag contains excluded words`, 'red')

    if(tag && tag.upvotes.includes(user.discord_id))
        return ctx.reply(user, `you already upvoted this tag`, 'red')

    if(tag && tag.status != 'clear')
        return ctx.reply(user, `this tag has been banned by moderator`, 'red')

    addConfirmation(ctx, user, `Do you want to ${tag? 'upvote' : 'add'} tag **#${tgTag}** for ${formatName(card)}?`, 
        { confirm: [user.discord_id], decline: [user.discord_id] },
        async (x) => {
            tag = tag || await new_tag(user, tgTag, card)

            tag.downvotes = tag.downvotes.filter(x => x != user.discord_id)
            tag.upvotes.push(user.discord_id)
            await tag.save()

            return ctx.reply(user, `confirmed tag **#${tgTag}** for ${formatName(card)}`)
        }, async (x) => {
            return ctx.reply(user, `tag ${tag? 'upvote' : 'adding'} was declined`, 'red')
        })
}))

cmd(['tag', 'down'], withTag(async (ctx, user, card, tag, tgTag) => {
    if(!tag)
        return ctx.reply(user, `tag #${tgTag} wasn't found for ${formatName(card)}`, 'red')

    if(tag.downvotes.includes(user.discord_id))
        return ctx.reply(user, `you already downvoted this tag`, 'red')

    if(tag.status != 'clear')
        return ctx.reply(user, `this tag has been banned by moderator`, 'red')

    addConfirmation(ctx, user, `Do you want to downvote tag **#${tgTag}** for ${formatName(card)}?`, 
        { confirm: [user.discord_id], decline: [user.discord_id] },
        async (x) => {
            tag.downvotes.push(user.discord_id)
            tag.upvotes = tag.upvotes.filter(x => x != user.discord_id)
            await tag.save()

            return ctx.reply(user, `downvoted tag **#${tgTag}** for ${formatName(card)}`)
        }, async (x) => {
            return ctx.reply(user, `tag downvote was declined`, 'red')
        }, `Please, use downvote to remove only irrelevant or incorrect tags`)
}, true))

pcmd(['admin', 'mod', 'tagmod'], ['tag', 'remove'], 
    withTag(async (ctx, user, card, tag, tgTag) => {

    if(!tag)
        return ctx.reply(user, `tag #${tgTag} wasn't found for ${formatName(card)}`, 'red')

    tag.status = 'removed'
    await tag.save()

    return ctx.reply(user, `removed tag **#${tgTag}** for ${formatName(card)}`)
}, true))

pcmd(['admin', 'mod', 'tagmod'], ['tag', 'restore'], 
    withTag(async (ctx, user, card, tag, tgTag) => {

    if(!tag)
        return ctx.reply(user, `tag #${tgTag} wasn't found for ${formatName(card)}`, 'red')

    tag.status = 'clear'
    await tag.save()

    return ctx.reply(user, `restored tag **#${tgTag}** for ${formatName(card)}`)
}, true))

pcmd(['admin', 'mod'], ['tag', 'ban'], 
    withTag(async (ctx, user, card, tag, tgTag) => {

    if(!tag)
        return ctx.reply(user, `tag #${tgTag} wasn't found for ${formatName(card)}`, 'red')

    const target = await fetchOnly(tag.author)
    target.ban = target.ban || {}
    target.ban.tags = target.ban.tags + 1 || 1
    tag.status = 'banned'
    target.markModified('ban')
    await tag.save()
    await target.save()

    return ctx.reply(user, `removed tag **#${tgTag}** for ${formatName(card)}. 
        User **${target.username}** has **${target.ban.tags}** banned tags and will be blocked from tagging at 3`)
}, true))
