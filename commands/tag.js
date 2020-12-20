const {cmd, pcmd}   = require('../utils/cmd')
const colors        = require('../utils/colors')
const Tag           = require('../collections/tag')

const {
    fetchOnly,
    updateUser,
} = require('../modules/user')

const { 
    new_tag,
    withTag,
    fetchCardTags,
    delete_tag,
    fetchTagNames,
    fetchUserTags,
} = require('../modules/tag')

const {
    formatName,
    withGlobalCards,
    bestMatch,
} = require('../modules/card')
const card = require('../modules/card')

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

        if(tgTag.length > 25)
            return ctx.reply(user, `tag can't be longer than **25** characters`, 'red') 

        if(tgTag.length < 2)
            return ctx.reply(user, `tag can't be shorter than **2** characters`, 'red') 
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

cmd(['tag', 'multi'], withTag(async (ctx, user, card, tag, tgTag, parsedargs) => {
    if(user.ban && user.ban.tags > 2)
        return ctx.reply(user, `you were banned from adding tags. To address this issue use \`->help support\``, 'red')

    let error = false
    let errorMsg = ''

    const check = async () => {
        if (error)
            return ctx.pgn.sendDecline(ctx.msg.channel.id, errorMsg)
        await Promise.all(
            parsedargs.tags.map(async x => {
                let newTag = await Tag.findOne({name: x, card: card.id});

                if(newTag && newTag.upvotes.includes(user.discord_id)){
                    error = true
                    errorMsg += `Tag **${x}** already upvoted\n`
                }

                if(newTag && newTag.status != 'clear') {
                    error = true
                    errorMsg += `Tag **${x}** has been banned by a moderator\n`
                }

                if(ctx.filter.isProfane(x)){
                    error = true
                    errorMsg += `Tag **${x}** is globally banned\n`
                }

                if(x.length > 25 || x.length < 2){
                    error = true
                    errorMsg += `Tag **${x}** is ${x.length < 2? 'too **short**, minimum 2 letters': 'too **long**, maximum 25 characters\n'}`
                }

            })
        )
    }

    let newTags = parsedargs.tags.join(' ')
    let question = `Do you want to add/upvote tags **#${newTags}** for ${formatName(card)}?`

    ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        check,
        force: ctx.globals.force,
        question,
        onConfirm: async (x) => {
            if (error)
                return

            parsedargs.tags.map(async x => {
                let findTag = await Tag.findOne({name: x, card: card.id});
                tag = findTag || await new_tag(user, x, card)
                if (!findTag) {
                    ctx.mixpanel.track(
                        "Tag Create", {
                            distinct_id: user.discord_id,
                            card_id: card.id,
                            card_name: card.name,
                            card_collection: card.col,
                            tag: x,
                        });
                }
                tag.downvotes = tag.downvotes.filter(x => x != user.discord_id)
                tag.upvotes.push(user.discord_id)
                await tag.save()
            })
            user = await updateUser(user, {$inc: {'dailystats.tags': parsedargs.tags.length}})

            ctx.reply(user, `confirmed tags **#${newTags}** for ${formatName(card)}`)
        },
        onDecline: async (x) => {
            if (error)
                return
            ctx.reply(user, `tags **#${newTags}** were declined`, 'red')
        }
    })
}, false))

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

pcmd(['admin', 'mod', 'tagmod'], ['tag', 'ban'], 
    withTag(async (ctx, user, card, tag, tgTag) => {

    const target = await fetchOnly(tag.author)
    target.ban = target.ban || {}
    target.ban.tags = target.ban.tags + 1 || 1
    tag.status = 'banned'
    target.markModified('ban')
    await tag.save()
    await target.save()

    try {
        await ctx.direct(target, `your tag **#${tgTag}** for ${formatName(card)} has been banned by moderator.
            Please make sure you add valid tags in the future. Learn more with \`->help tag\`
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
        resp.push(`Author: **${author.username}** \`${author.discord_id}\``)
        resp.push(`Status: **${tag.status}**`)

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
            switchPage: (data) => data.embed.fields[0] = { name: `Upvotes`, value: data.pages[data.pagenum]}
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

