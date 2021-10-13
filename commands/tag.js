const {cmd, pcmd}       = require('../utils/cmd')
const colors            = require('../utils/colors')
const Tag               = require('../collections/tag')
const {parseAuditArgs}  = require("../modules/audit")
const dateFormat        = require('dateformat')
const {getHelpEmbed}    = require('./misc')

const {
    fetchOnly,
    updateUser,
} = require('../modules/user')

const { 
    new_tag,
    withTag,
    withPurgeTag,
    fetchCardTags,
    delete_tag,
    fetchTagNames,
    fetchUserTags,
    logTagAudit,
    logTagAdd,
} = require('../modules/tag')

const {
    formatName,
    withGlobalCards,
    bestMatch,
} = require('../modules/card')

cmd(['tag', 'info'], withTag(async (ctx, user, card, tag) => {
    const author = await fetchOnly(tag.author)

    const resp = []
    resp.push(`Card: **${formatName(card)}**`)

    if(author) {
        resp.push(`Author: **${author.username}**`)
    } 
    resp.push(`Upvotes: **${tag.upvotes.length}**`)
    resp.push(`Downvotes: **${tag.downvotes.length}**`)
    resp.push(`Status: **${tag.status}**`)

    if(!author) {
        resp.push(`**This tag was automatically added by the system**`)
    } 

    return ctx.send(ctx.msg.channel.id, {
        title: `#${tag.name}`,
        description: resp.join('\n'),
        color: colors['blue']
    }, user.discord_id)
}))

cmd('tag', withTag(async (ctx, user, card, tag, tgTag, parsedargs) => {
    
    tgTag = tgTag.replace(/[^\w]/gi, '')

    const check = () => {
       if(user.ban && user.ban.tags > 2)
            return ctx.reply(user, `you were banned from adding tags. To address this issue use \`->help support\``, 'red')

        if(ctx.filter.isProfane(tgTag))
            return ctx.reply(user, `your tag contains excluded words`, 'red')

        if(tag && tag.upvotes.includes(user.discord_id))
            return ctx.reply(user, `you already upvoted this tag`, 'red')

        if(tag && tag.status != 'clear')
            return ctx.reply(user, `this tag has been banned by moderator`, 'red')

        if(tgTag.length > 35)
            return ctx.reply(user, `tag can't be longer than **35** characters`, 'red')

        if(tgTag.length < 2)
            return ctx.reply(user, `tag can't be shorter than **2** characters`, 'red') 
    }
    let question = `Do you want to ${tag? 'upvote' : 'add'} tag **#${tgTag}** for ${formatName(card)}?`

    if (parsedargs.firstTag)
        question += `\n Before confirming, please note that tags are **global**, not personal!\nRead the \`->rules\` on how to tag!`

    ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        check,
        force: ctx.globals.force,
        question,
        onConfirm: async (x) => {
            tag = tag || await new_tag(user, tgTag, card)

            tag.downvotes = tag.downvotes.filter(x => x != user.discord_id)
            tag.upvotes.push(user.discord_id)
            await tag.save()
            user = await updateUser(user, {$inc: {'dailystats.tags': 1}})

            ctx.mixpanel.track(
                "Tag Create", { 
                    distinct_id: user.discord_id,
                    card_id: card.id,
                    card_name: card.name,
                    card_collection: card.col,
                    tag: tgTag,
            });

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

    let remove = false
    let question = `Do you want to downvote tag **#${tgTag}** for ${formatName(card)}?`
    if(tag.author === user.discord_id 
        && tag.upvotes.includes(user.discord_id) 
        && tag.upvotes.length === 1) {
        remove = true
        question = `Do you want to **remove** your tag **#${tgTag}** for ${formatName(card)}?`
    }

    ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        check,
        force: ctx.globals.force,
        embed: { footer: { text: `Please, use downvote to remove only irrelevant or incorrect tags` } },
        question,
        onConfirm: async (x) => {
            if(remove) {
                await delete_tag(tag)
            } else {
                tag.downvotes.push(user.discord_id)
                tag.upvotes = tag.upvotes.filter(x => x != user.discord_id)
                await tag.save()
            }
            user = await updateUser(user, {$inc: {'dailystats.tags': (user.dailystats.tags <= 0? 0 : -1)}})

            return ctx.reply(user, `${remove? 'removed' : 'downvoted'} tag **#${tgTag}** for ${formatName(card)}`)
        }
    })
}))


cmd('tags', ['card', 'tags'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    if(parsedargs.isEmpty())
        return ctx.qhelp(ctx, user, 'tag')

    const card = bestMatch(cards)
    const tags = await fetchCardTags(card)

    if(tags.length === 0)
        return ctx.reply(user, `this card doesn't have any tags`)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(tags.map(x => 
            `\`${ctx.symbols.accept}${x.upvotes.length} ${ctx.symbols.decline}${x.downvotes.length}\`  **${x.name}** ${
                (x.upvotes.includes(user.discord_id) || x.downvotes.includes(user.discord_id))? '*' : ''
            }`)),
        switchPage: (data) => data.embed.description = `**Tags for** ${formatName(card)}:\n\n${data.pages[data.pagenum]}`,
        buttons: ['back', 'forward'],
        embed: {
            color: colors.blue,
        }
    })
}))

cmd(['tags', 'created'], withGlobalCards(async (ctx, user, cards, parsedargs) => {
    const userTags = await fetchUserTags(user)
    const cardIDs = cards.map(x => x.id)
    const tags = userTags.filter(x => cardIDs.includes(x.card))

    if(tags.length === 0)
        return ctx.reply(user, `cannot find your tags for matching cards (${cards.length} cards matched)`)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages: ctx.pgn.getPages(tags.map(x => {
            const card = ctx.cards[x.card]
            return `\`${ctx.symbols.accept}${x.upvotes.length} ${ctx.symbols.decline}${x.downvotes.length}\` **#${x.name}** - ${formatName(card)}`
        }, 10)),  
        switchPage: (data) => data.embed.description = `**${user.username}**, tags you created:\n\n${data.pages[data.pagenum]}`,
        buttons: ['back', 'forward'],
        embed: {
            color: colors.blue,
        }
    })
}))

pcmd(['admin', 'mod', 'tagmod'], ['tag', 'remove'], 
    withTag(async (ctx, user, card, tag, tgTag) => {

        const targetUser = await fetchOnly(tag.author)
        let log
        if (targetUser)
            log = await logTagAudit(ctx, user, tgTag, false, targetUser)
        tag.status = 'removed'
        await tag.save()
        if (log)
            await log.save()

        return ctx.reply(user, `removed tag **#${tgTag}** for ${formatName(card)}`)
}))

pcmd(['admin', 'mod', 'tagmod'], ['tag', 'restore'], 
    withTag(async (ctx, user, card, tag, tgTag) => {

        const target = await fetchOnly(tag.author)

        if (tag.status === 'banned') {
            target.ban = target.ban || {}
            target.ban.tags = target.ban.tags - 1 || 0
            target.markModified('ban')
            await target.save()
            let log = await logTagAudit(ctx, user, tgTag, true, target, true)
            if (log)
                await log.save()

            try {
                await ctx.direct(target, `your tag **#${tgTag}** for ${formatName(card)} has been cleared by a moderator.
            Your tag ban count has been lessened by 1.
            You have **${3 - target.ban.tags}** warning(s) remaining`)
            } catch {
                ctx.reply(user, `failed to send a warning to the user.`, 'red')
            }
        } else{
            await logTagAudit(ctx, user, tgTag, false, target, true)
        }


        tag.status = 'clear'
        await tag.save()

        return ctx.reply(user, `restored tag **#${tgTag}** for ${formatName(card)}`)
}))

pcmd(['admin', 'mod', 'tagmod'], ['tag', 'ban'], 
    withTag(async (ctx, user, card, tag, tgTag) => {

    const target = await fetchOnly(tag.author)

    if(!target) {
        return ctx.reply(user, `cannot ban system added tag. Please use remove function.`, 'red')
    }

    target.ban = target.ban || {}
    target.ban.tags = target.ban.tags + 1 || 1
    tag.status = 'banned'
    target.markModified('ban')
    await tag.save()
    await target.save()
    let log = await logTagAudit(ctx, user, tgTag, true, target)
    if (log)
        await log.save()

    try {
        await ctx.direct(target, `your tag **#${tgTag}** for ${formatName(card)} has been banned by moderator.
            Please make sure you add valid tags in the future as tags are not personal. Learn more with \`->rules\`
            You have **${3 - target.ban.tags}** warning(s) remaining`, 'red')
    } catch {
        ctx.reply(user, `failed to send a warning to the user.`, 'red')
    }

    return ctx.reply(user, `removed tag **#${tgTag}** for ${formatName(card)}. 
        User **${target.username}** has **${target.ban.tags}** banned tags and will be blocked from tagging at 3`)
}))

pcmd(['admin', 'mod', 'tagmod'], ['tag', 'mod', 'info'],
    withTag(async (ctx, user, card, tag, tgTag) => {
        const author = await fetchOnly(tag.author)
        const pages = []
        const resp = []
        resp.push(`Card: **${formatName(card)}**`)
        resp.push(`Upvotes: **${tag.upvotes.length}**`)
        resp.push(`Downvotes: **${tag.downvotes.length}**`)
        if (author)
            resp.push(`Author: **${author.username}** \`${author.discord_id}\``)
        else
            resp.push(`Author: **SYSTEM ADDED TAG**`)
        resp.push(`Status: **${tag.status}**`)
        resp.push(`Date Created: **${dateFormat(tag._id.getTimestamp(), "yyyy-mm-dd HH:MM:ss")}**`)

        const embed = {
            author: {name: `Info on tag #${tag.name}`},
            description: resp.join('\n'),
            color: colors['blue'],
            fields: []
        }
        tag.upvotes.map((t, i) => {
            if (i % 10 == 0) pages.push("")
            pages[Math.floor(i/10)] += `${t}\n`
        })
        return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
            pages, embed,
            buttons: ['back', 'forward'],
            switchPage: (data) => data.embed.fields[0] = { name: `Upvotes`, value: data.pages[data.pagenum] || "no upvotes Found"}
            })

}))

pcmd(['admin', 'mod', 'tagmod'], ['tag', 'list'], async (ctx, user, arg) => {
    const tags = await fetchTagNames(ctx, arg);
    const pages = []

    tags.map((t, i) => {
        if (i % 75 == 0) pages.push("")
        if ((i + 1) % 5 == 0) {
            pages[Math.floor(i/75)] += `**${t}**\n`
        } else {
            pages[Math.floor(i/75)] += `**${t}**  | `
        }
    })

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages,
        buttons: ['first', 'back', 'forward', 'last'],
        embed: {
            author: { name: `List of ${arg? `tags starting with "${arg}"`: 'all tag names' }: ${tags.length} results` },
            color: colors.blue,
        }
    })
})

pcmd(['admin', 'mod'], ['tag', 'purge', 'tag'], withPurgeTag(async (ctx, user, visible, args) => {
    let question = `Do you want to remove all tags with the name ${args.tags[0]}?`
    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question,
        onConfirm: async (x) => {
            let cardCount = visible.length
            visible.map(async (tag) => {
                tag.status = 'removed'
                await tag.save()
            })
            ctx.reply(user, `removed tag ${args.tags[0]} from ${cardCount} cards.`)
        },
        onDecline: async (x) => {
            ctx.reply(user, `tag purging was declined`, 'red')
        }
    })
}))

pcmd(['admin', 'mod'], ['tag', 'purge', 'user'], withPurgeTag(async (ctx, user, visible, args) => {
    let target = await fetchOnly(args.ids[0])
    let question = `Do you want to remove all tags made by **${target.username}** with no upvotes?`
    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question,
        onConfirm: async () => {
            await visible.map(async (tag, i) => {
                    tag.status = 'removed'
                    await tag.save()
            })
            let log = await logTagAudit(ctx, user, `**User Purged** ${visible.length} tags removed`, false, target)
            await log.save()
            ctx.reply(user, `removed all tags made by **${target.username}** with no upvotes`)
        },
        onDecline: async () => {
            ctx.reply(user, `tag purging was declined`, 'red')
        }
    })
}, false))

pcmd(['admin', 'mod'], ['tag', 'log', 'removed'],async (ctx, user, ...args) => {
    let parsedArgs = parseAuditArgs(ctx, args)

    if (!parsedArgs.id)
        return ctx.reply(user, 'valid user is required!', 'red')

    let target = await fetchOnly(parsedArgs.id)

    ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question: `Do you want to add **${parsedArgs.extraArgs.join(', ')}** to ${target.username}'s removed tags log?`,
        onConfirm: async () => {
            let auditlog = await logTagAdd(ctx, user, target, parsedArgs, false)
            await auditlog.save()
            ctx.reply(user, `added **${parsedArgs.extraArgs.join(', ')}** to ${target.username}'s removed tags log`)
        },
        onDecline: async () => {
            ctx.reply(user, `tag log adding was declined`, 'red')
        }
    })
})

pcmd(['admin', 'mod'], ['tag', 'log', 'banned'], async (ctx, user, ...args) => {
    let parsedArgs = parseAuditArgs(ctx, args)

    if (!parsedArgs.id)
        return ctx.reply(user, 'valid user is required!', 'red')

    let target = await fetchOnly(parsedArgs.id)

    ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question: `Do you want to add **${parsedArgs.extraArgs.join(', ')}** to ${target.username}'s banned tags log?`,
        onConfirm: async () => {
            let auditlog = await logTagAdd(ctx, user, target, parsedArgs, true)
            await auditlog.save()
            ctx.reply(user, `added **${parsedArgs.extraArgs.join(', ')}** to ${target.username}'s banned tags log`)
        },
        onDecline: async () => {
            ctx.reply(user, `tag log adding was declined`, 'red')
        }
    })
})

pcmd(['admin','mod', 'tagmod'], ['tagmod', 'help'], async (ctx, user) => {

    const help = ctx.audithelp.find(x => x.type === 'tagmod')
    const curpgn = getHelpEmbed(ctx, help, ctx.guild.prefix)

    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, curpgn)
})



