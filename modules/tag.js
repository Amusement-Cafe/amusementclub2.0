const asdate                = require('add-subtract-date')
const {Tag, AuditTags}      = require('../collections')
const cardMod               = require('./card')
const colors                = require("../utils/colors");
const dateFormat            = require(`dateformat`)

const fetchTaggedCards = async (tags) => {
    const res = await Tag.find({ name: { $in: tags }})
    return res.filter(x => check_tag(x)).map(x => x.card)
}

const fetchTagNames = async (ctx, start) => {
    let res
    if (start) {
        res = await Tag.find({name: {$in: new RegExp('^' + start)}})
    } else {
        res = await Tag.find()
    }

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

const new_tag = (user, name, card) => {
    const tag = new Tag()
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
const withTag = (callback, forceFind = true) => async(ctx, user, args) => {
    const parsedargs = args

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

    const priorTags = await Tag.findOne({author: user.discord_id, status: 'clear'})

    if (!priorTags)
        parsedargs.firstTag = true

    return callback(ctx, user, card, tag, tgTag, parsedargs)
}

const withPurgeTag = (callback, tagPurge = true) => async(ctx, user, ...args) => {
    const parsedargs = cardMod.parseArgs(ctx, args)

    let fetchUser, tag, visible
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'tag')

    if(parsedargs.isEmpty('ids') && !tagPurge) {
        return ctx.reply(user, 'valid user is required')
    } else if (!tagPurge) {
        fetchUser = parsedargs.ids[0]
    }


    if(tagPurge) {
        const tgTag = parsedargs.tags[0]
        tag = await Tag.find({name: tgTag})
        visible = tag.filter(x => check_tag(x)).reverse()
    } else {
        tag = await Tag.find({author: fetchUser})
        visible = tag.filter(x => check_tag(x) && x.upvotes.length === 1).reverse()
    }

    return callback(ctx, user, visible, parsedargs)
}

const logTagAudit = async(ctx, user, tag, ban, targetUser, restore = false) => {
    let log = await AuditTags.findOne({affectedUser: targetUser.discord_id})

    if ((restore && !log) || !ctx.audit.taglogchannel)
        return false

    let now = new Date()
    let baseEmbed = {
        author: { name: `Tag Log for ${targetUser.username} (${targetUser.discord_id})` },
        fields: [
            {
                name: "Banned",
                value: 'N/A'
            },
            {
                name: "Removed",
                value: 'N/A'
            }

        ],
        footer: {
            text: `Last edited by ${user.username} at ${dateFormat(now, "yyyy-mm-dd HH:MM:ss")}`
        },
        color: colors.green
    }

    if (!log && !restore)
        return await newAuditTag(ctx, user, tag, targetUser, ban, baseEmbed, now)

    let change = false
    let validRemoved = !(log.tagsRemoved.length === 0)
    let validBanned = !(log.tagsBanned.length === 0)
    let banned = validBanned? log.tagsBanned: []
    let removed = validRemoved? log.tagsRemoved: []
    let validChange = asdate.add(log.last_edited, 3, 'seconds') < now
    if (log && !restore) {
        if (ban && !log.tagsBanned.includes(tag)) {
            banned.push(tag)
            validBanned = true
            change = true
        }

        if (!ban && !log.tagsRemoved.includes(tag)) {
            tag === '**User Purged**'? removed=['**User Purged**']: removed.push(tag)
            validRemoved = true
            change = true
        }

        if (change) {
            validRemoved? baseEmbed.fields[1].value = formatAuditTags(removed): baseEmbed.fields[1].value="N/A"
            validBanned? baseEmbed.fields[0].value = formatAuditTags(banned): baseEmbed.fields[0].value="N/A"
            log.tagsRemoved = removed
            log.tagsBanned = banned
            log.last_edited = now
            if (validChange)
                await ctx.bot.editMessage(ctx.audit.taglogchannel, log.message_id, {embed: baseEmbed})
            return log
        }
    }

    if (restore) {
        if (ban && banned.includes(tag)) {
            banned = banned.filter(x => x !== tag)
            change = true
        }

        if (!ban && removed.includes(tag)) {
            removed = removed.filter(x => x !== tag)
            change = true
        }
        validRemoved = !(removed.length === 0)
        validBanned = !(banned.length === 0)

        if (change) {
            !validRemoved? baseEmbed.fields[1].value="N/A": baseEmbed.fields[1].value = formatAuditTags(removed)
            !validBanned? baseEmbed.fields[0].value="N/A": baseEmbed.fields[0].value = formatAuditTags(banned)
            log.tagsRemoved = removed
            log.tagsBanned = banned

            if (!validRemoved && !validBanned) {
                await ctx.bot.deleteMessage(ctx.audit.taglogchannel, log.message_id)
                await AuditTags.deleteOne({affectedUser: targetUser.discord_id})
                return log
            } else {
                if (validChange)
                    await ctx.bot.editMessage(ctx.audit.taglogchannel, log.message_id, {embed: baseEmbed})
                return log
            }

        }
    }
}

const newAuditTag = async (ctx, user, tag, target, ban, embed, now) => {
    const auditTag = await new AuditTags()
    auditTag.affectedUser = target.discord_id
    auditTag.commandRunner = user.discord_id
    auditTag.last_edited = now
    ban? auditTag.tagsBanned.push(tag): auditTag.tagsRemoved.push(tag)
    ban? embed.fields[0].value = tag: embed.fields[1].value = tag

    let newMessage = await ctx.bot.createMessage(ctx.audit.taglogchannel, {embed: embed})

    auditTag.message_id = newMessage.id
    return auditTag
}

const formatAuditTags = (tagList) =>{
    let text = ''
    let amount = 0
    tagList.map((x, i) => {
        if (i >= 10)
            amount += 1
        else if (i === (tagList.length - 1))
            text += `${x}`
        else
            text += `${x}, `
    })
    text += amount>0 ? `and ${amount} more`: ''
    return text
}

const logTagAdd = async (ctx, user, target, parsedArgs,  ban) => {
    let tagLog = await AuditTags.findOne({affectedUser: target.discord_id})
    if (!tagLog) {
        let lastTag = parsedArgs.extraArgs.pop()
        let tagLog = await logTagAudit(ctx, user, lastTag, ban, target)
        if (parsedArgs.extraArgs.length === 0)
            return tagLog
    }
    let tags = []
    parsedArgs.extraArgs.map((x, i) => {
        let lastItem = i === (parsedArgs.extraArgs.length - 1)
        if (lastItem)
            tags.push(x)
        if (!tagLog.tagsBanned.includes(x) && ban && !lastItem)
            tagLog.tagsBanned.push(x)
        if (!tagLog.tagsRemoved.includes(x) && !ban && !lastItem)
            tagLog.tagsRemoved.push(x)
    })
    if (ban)
        tagLog.markModified('tagsBanned')
    else
        tagLog.markModified('tagsRemoved')
    await tagLog.save()
    return await logTagAudit(ctx, user, tags[0], ban, target)
}

module.exports = Object.assign(module.exports, {
    fetchTaggedCards,
    fetchCardTags,
    fetchTagNames,
    fetchUserTags,
    new_tag,
    check_tag,
    withTag,
    withPurgeTag,
    delete_tag,
    logTagAudit,
    logTagAdd
})
