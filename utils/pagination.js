const { rct }   = require('./cmd')
const colors    = require('./colors')
const asdate    = require('add-subtract-date')

let paginations = [], confirmations = []

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
        custom_id: "⏪"
    },
    back: {
        type: 2,
        label: "Back",
        style: 1,
        custom_id: "⬅"
    },
    forward: {
        type: 2,
        label: "Next",
        style: 1,
        custom_id: "➡"
    },
    last: {
        type: 2,
        label: "Last",
        style: 1,
        custom_id: "⏩"
    },
    close: {
        type: 2,
        label: "Delete",
        style: 4,
        custom_id: "🚫"
    },
    confirm: {
        type: 2,
        label: "Confirm",
        style: 3,
        custom_id: "✅"
    },
    decline: {
        type: 2,
        label: "Decline",
        style: 4,
        custom_id: "❌"
    }
}

const defaultpgn = {
    switchPage: data => data.embed.description = data.pages[data.pagenum],
    pages: ['Start page'],
    buttons: defaults.pgnButtons
}

const addPagination = async (interaction, params) => {
    const userID = interaction.member.id
    const oldpagination = paginations.filter(x => x.userID === userID)[0]
    try {
        if(oldpagination && oldpagination.channel && oldpagination.msg) {
            await interaction.editMessage(oldpagination.msg, {components: []})
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
        interaction
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


    const interMsg = await interaction.createMessage({ embed: obj.embed, components: obj.components })
    obj.msg = interMsg.id
    obj.channel = interMsg.channel.id
}

const addConfirmation = async (interaction, params) => {
    const userID = interaction.member.id
    const channelID = interaction.channel.id
    const old = confirmations.filter(x => x.userID === userID)[0]
    try {
        if(old && old.channel && old.msg)
            await interaction.editMessage(old.msg, {components: []})
    } catch(e) {}

    confirmations = confirmations.filter(x => x.userID != userID)

    const obj = Object.assign({
        components: [{ type: 1, components: []}],
        userID,
        embed: Object.assign({}, defaults.cfmEmbed),
        perms: { confirm: [userID], decline: [userID] },
        onConfirm: () => sendConfirm(interaction),
        onDecline: () => sendDecline(interaction),
        onTimeout: () => sendTimeout(interaction),
        onError: () => { },
        expires: asdate.add(new Date(), defaults.confirmExpires, 'seconds'),
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

    const msg = await interaction.createMessage({ embed: obj.embed, components: obj.components })
    obj.msg = msg.id
    obj.channel = msg.channel.id
    obj.channelType = msg.channel.type
}

const doSwitch =  async (ctx, newpage) => {
    const userID = ctx.interaction.member.id
    const data = paginations.filter(x => x.msg === ctx.interaction.message.id && x.perms.includes(userID))[0]
    if(!data) return

    const max = data.pages.length - 1
    data.pagenum = newpage(data.pagenum)

    if(data.pagenum === Infinity || (defaults.wrap && data.pagenum < 0)) data.pagenum = max
    else if(defaults.wrap && data.pagenum > max) data.pagenum = 0
    else if(!defaults.wrap) data.pagenum = Math.min(Math.max(data.pagenum, 0), max)

    // emitter.emit('switch', data)
    data.switchPage(data)

    if(data.embed.footer.text.startsWith('Page'))
        data.embed.footer.text = `Page ${data.pagenum + 1}/${data.pages.length}`
    await ctx.interaction.editOriginalMessage({ embed: data.embed })

}

const doResolve = async (ctx, reaction) => {
    let data
    const userID = ctx.interaction.member.id
    if(reaction === chars.confirm)
        data = confirmations.filter(x => x.msg === ctx.interaction.message.id
            && x.perms.confirm.includes(userID))[0]

    if(reaction === chars.decline)
        data = confirmations.filter(x => x.msg === ctx.interaction.message.id
            && x.perms.decline.includes(userID))[0]

    if(!data) return

    confirmations = confirmations.filter(x => x.msg != ctx.interaction.message.id)

    if(reaction === chars.decline)
        await data.onDecline(userID)

    if(data.check && await data.check())
        return await data.onError(userID)

    if(reaction === chars.confirm)
        await data.onConfirm(userID)

    // emitter.emit('resolve', reaction === chars.confirm, data)
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

const remove = () => {

}

const sendConfirm = (interaction) => {
    interaction.editOriginalMessage({embed: {description: 'Operaction was confirmed!', color: colors.green}, components: []})
}

const sendDecline = (interaction) => {
    interaction.editOriginalMessage({embed: {description: 'Operation was declined!', color: colors.red}, components: []})
}

const sendTimeout = (interaction) => {
    interaction.editOriginalMessage({embed: {description: 'This confirmation dialog has expired!', color: colors.grey}, components: []})
}

rct(chars.first,   (ctx) => doSwitch(ctx,cur => 0))
rct(chars.back,    (ctx) => doSwitch(ctx,cur => cur - 1))
rct(chars.forward, (ctx) => doSwitch(ctx,cur => cur + 1))
rct(chars.last,    (ctx) => doSwitch(ctx,cur => Infinity))
rct(chars.confirm, (ctx) => doResolve(ctx, chars.confirm))
rct(chars.decline, (ctx) => doResolve(ctx, chars.decline))



module.exports = {
    addPagination,
    addConfirmation,
    buttons,
    chars,
    getPages
}
