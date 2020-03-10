const {cmd, pcmd}   = require('../utils/cmd')
const colors        = require('../utils/colors')
const Filter        = require('bad-words')
const filter        = new Filter();

const {
    fetchOnly,
    updateUser
} = require('../modules/user')

const { 
    new_tag,
    check_tag,
    withTag
} = require('../modules/tag')

const {
    formatName,
} = require('../modules/card')

cmd(['tag', 'info'], withTag(async (ctx, user, card, tag) => {
    const author = await fetchOnly(tag.author)

    const resp = []
    resp.push(`Card: **${formatName(card)}**`)
    resp.push(`Upvotes: **${tag.upvotes.length}**`)
    resp.push(`Downvotes: **${tag.downvotes.length}**`)
    resp.push(`Author: **${author.username}**`)
    resp.push(`Status: **${tag.status}**`)

    return ctx.send(ctx.msg.channel.id, {
        title: `#${tag.name}`,
        description: resp.join('\n'),
        color: colors['blue']
    }, user.discord_id)
}))

cmd('tag', withTag(async (ctx, user, card, tag, tgTag, parsedargs) => {
    const check = () => {
       if(user.ban && user.ban.tags > 2)
            return ctx.reply(user, `you were banned from adding tags. To address this issue use \`->help support\``, 'red')

        if(filter.isProfane(tgTag))
            return ctx.reply(user, `your tag contains excluded words`, 'red')

        if(tag && tag.upvotes.includes(user.discord_id))
            return ctx.reply(user, `you already upvoted this tag`, 'red')

        if(tag && tag.status != 'clear')
            return ctx.reply(user, `this tag has been banned by moderator`, 'red')

        if(tgTag.length > 25)
            return ctx.reply(user, `tag can't be longer than **25** characters`, 'red') 
    }

    ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        check,
        force: ctx.globals.force,
        question: `Do you want to ${tag? 'upvote' : 'add'} tag **#${tgTag}** for ${formatName(card)}?`,

        onConfirm: async (x) => {
            tag = tag || await new_tag(user, tgTag, card)

            tag.downvotes = tag.downvotes.filter(x => x != user.discord_id)
            tag.upvotes.push(user.discord_id)
            await tag.save()
            user = await updateUser(user, {$inc: {'dailystats.tags': 1}})

            ctx.reply(user, `confirmed tag **#${tgTag}** for ${formatName(card)}`)
        },

        onDecline: async (x) => {
            ctx.reply(user, `tag ${tag? 'upvote' : 'adding'} was declined`, 'red')
        }
    })
}, false))

cmd(['tag', 'down'], withTag(async (ctx, user, card, tag, tgTag, parsedargs) => {
    const check = () => {
        if(tag.downvotes.includes(user.discord_id))
            return ctx.reply(user, `you already downvoted this tag`, 'red')

        if(tag.status != 'clear')
            return ctx.reply(user, `this tag has been banned by moderator`, 'red')
    }

    ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        check,
        force: ctx.globals.force,
        embed: { footer: { text: `Please, use downvote to remove only irrelevant or incorrect tags` } },
        question: `Do you want to downvote tag **#${tgTag}** for ${formatName(card)}?`,
        onConfirm: async (x) => {
            tag.downvotes.push(user.discord_id)
            tag.upvotes = tag.upvotes.filter(x => x != user.discord_id)
            await tag.save()
            user = await updateUser(user, {$inc: {'dailystats.tags': (user.dailystats.tags <= 0? 0 : -1)}})

            return ctx.reply(user, `downvoted tag **#${tgTag}** for ${formatName(card)}`)
        }
    })
}))

pcmd(['admin', 'mod', 'tagmod'], ['tag', 'remove'], 
    withTag(async (ctx, user, card, tag, tgTag) => {

    tag.status = 'removed'
    await tag.save()

    return ctx.reply(user, `removed tag **#${tgTag}** for ${formatName(card)}`)
}))

pcmd(['admin', 'mod', 'tagmod'], ['tag', 'restore'], 
    withTag(async (ctx, user, card, tag, tgTag) => {

    tag.status = 'clear'
    await tag.save()

    return ctx.reply(user, `restored tag **#${tgTag}** for ${formatName(card)}`)
}))

pcmd(['admin', 'mod'], ['tag', 'ban'], 
    withTag(async (ctx, user, card, tag, tgTag) => {

    const target = await fetchOnly(tag.author)
    target.ban = target.ban || {}
    target.ban.tags = target.ban.tags + 1 || 1
    tag.status = 'banned'
    target.markModified('ban')
    await tag.save()
    await target.save()

    return ctx.reply(user, `removed tag **#${tgTag}** for ${formatName(card)}. 
        User **${target.username}** has **${target.ban.tags}** banned tags and will be blocked from tagging at 3`)
}))
