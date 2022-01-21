const {cmd}     = require('../utils/cmd')
const {numFmt}  = require('../utils/tools')
const _         = require('lodash')
const colors    = require('../utils/colors')

const { 
    itemInfo,
    buyItem,
    withItem,
} = require('../modules/item')

cmd('store', 'shop', ['store', 'view'], async (ctx, user, cat) => {
    const cats = _.uniq(ctx.items.filter(x => x.price >= 0).map(x => x.type))
    cat = cat? cat.replace(/s$/i, '') : null

    if(parseInt(cat))
        cat = cats[parseInt(cat) - 1]

    if(!cat || !cats.includes(cat))
        return ctx.reply(user, {
            title: `Welcome to the store!`,
            color: colors.deepgreen,
            description: `please select one of the categories and type 
                \`${ctx.prefix}store [category]\` to view the items\n
                ${cats.map((x, i) => `${i + 1}. ${x}`).join('\n')}`
            })

    const items = ctx.items.filter(x => x.type === cat && x.price > 0)
    const embed = {
        author: { name: `${cat} list`.toUpperCase() },
        color: colors.deepgreen,
        description: items[0].typedesc,
        fields: [{
            name: `Usage`,
            value: `To view the item details use \`${ctx.prefix}store info [item id]\`
                To buy the item use \`${ctx.prefix}store buy [item id]\`
                To use the item use \`${ctx.prefix}inv use [item id]\``
        }]}

    const pages = ctx.pgn.getPages(items.map((x, i) => `${i + 1}. [${numFmt(x.price)} ${ctx.symbols[items[0].currency]}] \`${x.id}\` **${x.name}** (${x.desc})`), 5)
    return ctx.sendPgn(ctx, user, {
        pages, embed,
        buttons: ['back', 'forward'],
        switchPage: (data) => data.embed.fields[1] = { name: `Item list`, value: data.pages[data.pagenum] }
    })
})

cmd(['store', 'info'], ['shop', 'info'], ['item', 'info'], withItem(async (ctx, user, item, args) => {
    const embed = await itemInfo(ctx, user, item)
    embed.color = colors.deepgreen
    embed.author = { name: item.name }

    return ctx.send(ctx.interaction, embed)
}))

cmd(['store', 'buy'], ['shop', 'buy'], withItem(async (ctx, user, item, args) => {
    const catNum = _.uniq(ctx.items.filter(x => x.price >= 0).map(x => x.type)).indexOf(item.type) + 1
    if (catNum == 3 && user.dailystats.store3 >= 3)
        return ctx.reply(user, `you have run out of available purchases from this store. Please try again after your next daily!`, 'red')

    let symbol = ctx.symbols[ctx.items.filter(x => x.type === item.type)[0].currency]
    let balance = symbol === ctx.symbols.lemon? user.lemons: user.exp
    if(balance < item.price)
        return ctx.reply(user, `you have to have at least **${item.price}** ${symbol} to buy this item`, 'red')

    return ctx.sendCfm(ctx, user, {
        question: `Do you want to buy **${item.name} ${item.type}** for **${item.price}** ${symbol}?`,
        force: ctx.globals.force,
        onConfirm: async (x) => {
            buyItem(ctx, user, item)
            user.dailystats.store3 += 1
            symbol === ctx.symbols.lemon? user.lemons -= item.price: user.exp -= item.price
            await user.save()

            return ctx.reply(user, `you purchased **${item.name} ${item.type}** for **${item.price}** ${symbol}
                The item has been added to your inventory. See \`${ctx.prefix}inv info ${item.id}\` for details
                ${catNum == 3? `You have **${3-user.dailystats.store3}** purchase(s) left for this store today!`: ''}`, 'green')
        }
    })
}))
