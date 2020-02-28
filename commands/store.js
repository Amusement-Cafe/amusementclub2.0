const {cmd}     = require('../utils/cmd')
const _         = require('lodash')
const colors    = require('../utils/colors')

const { 
    itemInfo,
    buyItem
} = require('../modules/item')

cmd('store', 'shop', async (ctx, user, cat) => {
    const cats = _.uniq(ctx.items.filter(x => x.price >= 0).map(x => x.type))
    cat = cat? cat.replace(/s$/i, '') : null

    if(parseInt(cat))
        cat = cats[parseInt(cat) - 1]

    if(!cat || !cats.includes(cat))
        return ctx.reply(user, {
            title: `Welcome to the store!`,
            color: colors.deepgreen,
            description: `please select one of the categories and type 
                \`->store [category]\` to view the items\n
                ${cats.map((x, i) => `${i + 1}. ${x}`).join('\n')}`
            })

    const items = ctx.items.filter(x => x.type === cat)
    const embed = {
        author: { name: `${cat}s`.toUpperCase() },
        color: colors.deepgreen,
        description: items[0].typedesc,
        fields: [{
            name: `Usage`,
            value: `To view the item details use \`->store info [item id]\`
                To buy the item use \`->store buy [item id]\``
        }]}

    const pages = ctx.pgn.getPages(items.map((x, i) => `${i + 1}. [${x.price} ${ctx.symbols.tomato}] \`${x.id}\` **${x.name}** (${x.desc})`), 5)
    return ctx.pgn.addPagination(user.discord_id, ctx.msg.channel.id, {
        pages, embed,
        buttons: ['back', 'forward'],
        switchPage: (data) => data.embed.fields[1] = { name: `Item list`, value: data.pages[data.pagenum] }
    })
})

cmd(['store', 'info'], ['shop', 'info'], ['item', 'info'], async (ctx, user, ...args) => {
    const reg = new RegExp(args.join('*.'), 'gi')
    let item = ctx.items.find(x => reg.test(x.id))
    if(!item && !isNaN(args[0]))
        item = ctx.items[parseInt(args[0]) - 1]

    if(!item)
        return ctx.reply(user, `item with ID \`${args.join('')}\` not found`, 'red')

    const embed = itemInfo(ctx, user, item)
    embed.color = colors.deepgreen
    embed.author = { name: item.name }

    return ctx.send(ctx.msg.channel.id, embed)
})

cmd(['store', 'buy'], ['shop', 'buy'], async (ctx, user, ...args) => {
    const reg = new RegExp(args.join('*.'), 'gi')
    let item = ctx.items.find(x => reg.test(x.id))
    if(!item && !isNaN(args[0]))
        item = ctx.items[parseInt(args[0]) - 1]

    if(!item)
        return ctx.reply(user, `item with ID \`${args.join('')}\` not found or cannot be purchased`, 'red')

    if(user.exp < item.price)
        return ctx.reply(user, `you have to have at least \`${item.price}\` ${ctx.symbols.tomato} to buy this item`, 'red')

    return ctx.pgn.addConfirmation(user.discord_id, ctx.msg.channel.id, {
        question: `Do you want to buy **${item.name} ${item.type}** for **${item.price}** ${ctx.symbols.tomato}?`,
        force: ctx.globals.force,
        onConfirm: async (x) => {
            buyItem(ctx, user, item)
            user.exp -= item.price
            await user.save()

            return ctx.reply(user, `you purchased **${item.name} ${item.type}** for **${item.price}** ${ctx.symbols.tomato}
                The item has been added to your inventory. See \`->inv info ${item.id}\` for details`, 'green')
        }
    })
})
