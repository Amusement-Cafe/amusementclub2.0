const { rct }   = require('./cmd')
const colors    = require('./colors')
const asdate    = require('add-subtract-date')

let paginations = [], confirmations = [], confirmPaginations = []

const defaults = {
    expires: 600,
    confirmExpiration: 60,
    check: 5,
    wrap: true,
    pgnEmbed: { title: 'Pagination Dialog' },
    cfmEmbed: { title: 'Confirmation Dialog' },
    pgnButtons: ['first', 'back', 'forward', 'last'],
}

const chars = {
    first: '⏪',
    back: '⬅',
    forward: '➡',
    last: '⏩',
    close: '🚫',
    confirm: '✅',
    decline: '❌'
}

const buttons = {
    first: {
        type: 2,
        label: "First",
        style: 1,
        customID: "⏪"
    },
    back: {
        type: 2,
        label: "Back",
        style: 1,
        customID: "⬅"
    },
    forward: {
        type: 2,
        label: "Next",
        style: 1,
        customID: "➡"
    },
    last: {
        type: 2,
        label: "Last",
        style: 1,
        customID: "⏩"
    },
    close: {
        type: 2,
        label: "Delete",
        style: 4,
        customID: "🚫"
    },
    confirm: {
        type: 2,
        label: "Confirm",
        style: 3,
        customID: "✅"
    },
    decline: {
        type: 2,
        label: "Decline",
        style: 4,
        customID: "❌"
    }
}

const defaultpgn = {
    switchPage: data => data.embed.description = data.pages[data.pagenum],
    pages: ['Start page'],
    buttons: defaults.pgnButtons
}

const addPagination = async (ctx, params) => {
    const userID = ctx.interaction.member? ctx.interaction.member.id: ctx.interaction.user.id
    const oldpagination = paginations.filter(x => x.userID === userID)[0]
    try {
        if(oldpagination && oldpagination.channel && oldpagination.msg) {
            await ctx.bot.rest.interactions.editOriginalMessage(ctx.bot.application.id, oldpagination.interaction.token, {embeds: [oldpagination.embed], components: []})
        }
    } catch(e) {}

    paginations = paginations.filter(x => x.userID != userID)

    const pagenum = 0
    const pages = params.pages || defaultpgn.pages
    const obj = Object.assign({
        pagenum, userID,
        perms: [userID],
        embed: Object.assign({}, defaults.pgnEmbed),
        expires: asdate.add(new Date(), defaults.expires, 'seconds'),
        components: [],
        interaction: ctx.interaction
    }, defaultpgn, params)

    obj.embed.color = obj.embed.color || colors.blue
    obj.embed.footer = obj.embed.footer || { text: `Page 1/${pages.length}` }

    obj.switchPage(obj)
    paginations.push(obj)

    try {
        if(obj.pages.length > 1) {
            obj.components.push({ type: 1, components: []})
            if(obj.buttons.includes('first')) obj.components[0].components.push(buttons.first)
            if(obj.buttons.includes('back')) obj.components[0].components.push(buttons.back)
            if(obj.buttons.includes('forward')) obj.components[0].components.push(buttons.forward)
            if(obj.buttons.includes('last')) obj.components[0].components.push(buttons.last)
            if(obj.buttons.includes('close')) obj.components[0].components.push(buttons.close)
        }
    } catch(e) {
        paginations = paginations.filter(x => x.userID != userID)
    }

    let interMsg

    if (params.direct) {
        const ch = await ctx.bot.getDMChannel(userID)
        interMsg = await ctx.bot.createMessage(ch.id, {embed: obj.embed, components: obj.components})
        await ctx.interaction.createMessage({embed: {color: colors.green, description: 'A DM has been sent to you'}})
    } else {
        if (params.edit && !params.extra)
            interMsg = await ctx.interaction.editOriginal({ embeds: [obj.embed], components: obj.components })
        else if (params.edit && params.extra){
            await params.extra.editParent({ embeds: [obj.embed], components: obj.components })
            interMsg = await params.extra.getOriginal()
        }
        else
            interMsg = await ctx.interaction.createFollowup({ embeds: [obj.embed], components: obj.components })
    }
    obj.msg = interMsg.id
    obj.channel = interMsg.channelID
}

const addConfirmation = async (ctx, params) => {
    const userID = ctx.interaction.member? ctx.interaction.member.id: ctx.interaction.user.id
    const old = confirmations.filter(x => x.userID === userID)[0]
    try {
        if(old && old.channel && old.msg)
            await ctx.bot.rest.interactions.editOriginalMessage(ctx.bot.application.id, old.interaction.token, {embeds: [old.embed], components: []})
    } catch(e) {}

    confirmations = confirmations.filter(x => x.userID != userID)

    const obj = Object.assign({
        components: [{ type: 1, components: []}],
        userID,
        embed: Object.assign({}, defaults.cfmEmbed),
        perms: { confirm: [userID], decline: [userID] },
        onConfirm: () => sendConfirm(ctx.interaction),
        onDecline: () => sendDecline(ctx.interaction),
        onTimeout: () => sendTimeout(ctx.interaction),
        onError: () => { },
        expires: asdate.add(new Date(), defaults.confirmExpiration, 'seconds'),
        interaction: ctx.interaction,
    }, params)

    if(obj.check && await obj.check())
        return await obj.onError(userID)

    if(params.force)
        return await obj.onConfirm(userID)


    obj.embed.color = obj.embed.color || colors.yellow
    obj.embed.description = obj.embed.description || params.question

    obj.components[0].components.push(buttons.confirm)
    obj.components[0].components.push(buttons.decline)

    confirmations.push(obj)

    const msg = await ctx.interaction.createFollowup({ embeds: [obj.embed], components: obj.components })
    obj.msg = msg.id
    obj.channel = msg.channelID
}

const addConfirmPagination = async (ctx, params) => {
    const userID = ctx.interaction.member? ctx.interaction.member.id: ctx.interaction.user.id
    const oldpagination = confirmPaginations.filter(x => x.userID === userID)[0]
    try {
        if(confirmPaginations && oldpagination.channel && oldpagination.msg) {
            await ctx.bot.rest.interactions.editOriginalMessage(ctx.bot.application.id, oldpagination.interaction.token, {embeds: [oldpagination.embed], components: []})
        }
    } catch(e) {}

    confirmPaginations = confirmPaginations.filter(x => x.userID != userID)

    const pagenum = 0
    const pages = params.pages || defaultpgn.pages
    const obj = Object.assign({
        pagenum, userID,
        perms: { confirm: [userID], decline: [userID], switch: [userID]},
        embed: Object.assign({}, defaults.pgnEmbed),
        expires: asdate.add(new Date(), defaults.expires, 'seconds'),
        components: [{ type: 1, components: []}],
        interaction: ctx.interaction,
        onConfirm: () => sendConfirm(ctx.interaction),
        onDecline: () => sendDecline(ctx.interaction),
        onTimeout: () => sendTimeout(ctx.interaction),
        onError: () => { },
    }, defaultpgn, params)

    obj.embed.color = obj.embed.color || colors.blue
    obj.embed.footer = obj.embed.footer || { text: `Page 1/${pages.length}` }

    if(obj.check && await obj.check())
        return await obj.onError(userID)

    if(params.force)
        return await obj.onConfirm(userID)

    obj.switchPage(obj)
    confirmPaginations.push(obj)

    try {
        if(obj.pages.length > 1) {
            if(obj.buttons.includes('first')) obj.components[0].components.push(buttons.first)
            if(obj.buttons.includes('back')) obj.components[0].components.push(buttons.back)
            if(obj.buttons.includes('forward')) obj.components[0].components.push(buttons.forward)
            if(obj.buttons.includes('last')) obj.components[0].components.push(buttons.last)
            if(obj.buttons.includes('close')) obj.components[0].components.push(buttons.close)
            if (obj.buttons.length > 5) {
                obj.components.push({ type: 1, components: []})
                obj.components[1].components.push(buttons.confirm)
                obj.components[1].components.push(buttons.decline)
            } else {
                obj.components[0].components.push(buttons.confirm)
                obj.components[0].components.push(buttons.decline)
            }
        } else {
            obj.components[0].components.push(buttons.confirm)
            obj.components[0].components.push(buttons.decline)
        }
    } catch(e) {
        confirmPaginations = confirmPaginations.filter(x => x.userID != userID)
    }

    let interMsg

    if (params.edit)
        interMsg = await ctx.interaction.editOriginal({ embeds: [obj.embed], components: obj.components })
    else
        interMsg = await ctx.interaction.createFollowup({ embeds: [obj.embed], components: obj.components })

    obj.msg = interMsg.id
    obj.channel = interMsg.channelID
}

const doSwitch =  async (ctx, newpage) => {
    const userID = ctx.interaction.member? ctx.interaction.member.id: ctx.interaction.user.id
    const data = paginations.filter(x => x.msg === ctx.interaction.message.id && x.perms.includes(userID))[0] ||
        confirmPaginations.filter(x => x.msg === ctx.interaction.message.id && x.perms.switch.includes(userID))[0]
    if (!data) return

    const max = data.pages.length - 1
    data.pagenum = newpage(data.pagenum)

    if(data.pagenum === Infinity || (defaults.wrap && data.pagenum < 0)) data.pagenum = max
    else if(defaults.wrap && data.pagenum > max) data.pagenum = 0
    else if(!defaults.wrap) data.pagenum = Math.min(Math.max(data.pagenum, 0), max)

    data.switchPage(data)

    if(data.embed.footer.text.startsWith('Page'))
        data.embed.footer.text = `Page ${data.pagenum + 1}/${data.pages.length}`
    await ctx.interaction.editParent({ embeds: [data.embed] })

}

const doResolve = async (ctx, reaction) => {
    let data
    const userID = ctx.interaction.member? ctx.interaction.member.id: ctx.interaction.user.id
    if(reaction === chars.confirm)
        data = confirmations.filter(x => x.msg === ctx.interaction.message.id && x.perms.confirm.includes(userID))[0] ||
            confirmPaginations.filter(x => x.msg === ctx.interaction.message.id && x.perms.confirm.includes(userID))[0]

    if(reaction === chars.decline)
        data = confirmations.filter(x => x.msg === ctx.interaction.message.id && x.perms.decline.includes(userID))[0] ||
            confirmPaginations.filter(x => x.msg === ctx.interaction.message.id && x.perms.decline.includes(userID))[0]

    if(!data) return

    confirmations = confirmations.filter(x => x.msg != ctx.interaction.message.id)
    confirmPaginations = confirmPaginations.filter(x => x.msg != ctx.interaction.message.id)

    if(reaction === chars.decline)
        await data.onDecline(userID, ctx.interaction)

    if(data.check && await data.check())
        return await data.onError(userID, ctx.interaction)

    if(reaction === chars.confirm)
        await data.onConfirm(userID, ctx.interaction)
}

const getPages = (array, split = 10, maxCharacters = 4096) => {
    let count = 0, page = 0
    const pages = [""]
    array.map(x => {
        const entry = `${x}\n`

        if(count >= split || pages[page].length + entry.length > maxCharacters) {
            page++
            count = 1
            pages[page] = entry
        } else {
            count++
            pages[page] += entry
        }
    })

    return pages
}

const remove = (ctx) => {
    const data = paginations.filter(x => x.msg === ctx.interaction.message.id && x.perms.includes(ctx.interaction.interaction.member? ctx.interaction.member.id: ctx.interaction.user.id))[0]
    if (!data)
        return

    paginations.filter(x => x.msg !== ctx.interaction.message.id)
    data.interaction.deleteOriginal().catch(e => e)
}

const sendConfirm = (interaction) => {
    interaction.editOriginal({embeds: [{description: 'Operation was confirmed!', color: colors.green}], components: []}).catch(e => e)
}

const sendDecline = (interaction) => {
    interaction.editOriginal({embeds: [{description: 'Operation was declined!', color: colors.red}], components: []}).catch(e => e)
}

const sendTimeout = (interaction) => {
    interaction.editOriginal({embeds: [{description: 'This confirmation dialog has expired!', color: colors.grey}], components: []}).catch(e => e)
}

const timeoutTick = () => {
    const now = new Date()
    paginations.filter(x => x.expires < now).map(async y => {
        try {
            await y.interaction.editOriginal({embeds: [y.embed], components: []})
        } catch (e) {
            process.send({error: {message: e.message, stack: e.stack}})
        }
    })
    paginations = paginations.filter(x => x.expires >= now)

    confirmations.filter(x => x.expires < now).map(async y => {
        try {
            await y.interaction.editOriginal({embeds: [y.embed], components: []})
            await y.onTimeout()
        } catch (e) {
            process.send({error: {message: e.message, stack: e.stack}})
        }
    })
    confirmations = confirmations.filter(x => x.expires >= now)

    confirmPaginations.filter(x => x.expires < now).map(async y => {
        try {
            await y.interaction.editOriginal({embeds: [y.embed], components: []})
            await y.onTimeout()
        } catch (e) {
            process.send({error: {message: e.message, stack: e.stack}})
        }
    })
    confirmPaginations = confirmPaginations.filter(x => x.expires >= now)
}

rct(chars.first,   (ctx) => doSwitch(ctx,cur => 0))
rct(chars.back,    (ctx) => doSwitch(ctx,cur => cur - 1))
rct(chars.forward, (ctx) => doSwitch(ctx,cur => cur + 1))
rct(chars.last,    (ctx) => doSwitch(ctx,cur => Infinity))
rct(chars.confirm, (ctx) => doResolve(ctx, chars.confirm))
rct(chars.decline, (ctx) => doResolve(ctx, chars.decline))
rct(chars.close,   (ctx) => remove(ctx))



module.exports = {
    addPagination,
    addConfirmation,
    addConfirmPagination,
    buttons,
    chars,
    getPages,
    timeoutTick,
}
