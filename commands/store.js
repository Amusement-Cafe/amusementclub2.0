const {cmd}     = require('../utils/cmd')
const _         = require('lodash')
const colors    = require('../utils/colors')

const {
    addConfirmation
} = require('../utils/confirmator')

cmd('store', async (ctx, user, cat) => {
    const cats = _.uniq(ctx.items.filter(x => x.price >= 0).map(x => x.type))

    if(!cat || !cats.includes(cat))
        return ctx.reply(user, {
            title: `Welcome to the store!`,
            color: colors.deepgreen,
            description: `please select one of the categories and type 
                \`->store [category]\` to view the items\n
                ${cats.map((x, i) => `${i + 1}. ${x}`).join('\n')}`
            })

    const items = ctx.items.filter(x => x.type === cat)
    return ctx.send(ctx.msg.channel.id, {
        author: { name: `${cat}s` },
        color: colors.deepgreen,
        description: `${items[0].typedesc}\n To view the item details use \`->store info [item id]\`
            To buy the item use \`->store buy [item id]\`\n
            ${items.map((x, i) => `${i + 1}. [${x.price} ${ctx.symbols.tomato}] \`${x.id}\` **${x.name}** (${x.desc})`).join('\n')}`
        })
})

cmd(['store', 'info'], ['inv', 'info'], ['item', 'info'], async (ctx, user, itemid) => {
    const item = ctx.items.filter(x => x.id === itemid)[0]

    if(!item)
        return ctx.reply(user, `item with ID \`${itemid}\` not found`, 'red')

    return ctx.send(ctx.msg.channel.id, {
        author: { name: item.name },
        description: item.fulldesc,
        color: colors.deepgreen,
        fields: item.levels.map((x, i) => { return {
            name: `Level ${i + 1}`, 
            value: `Price: **${x.price}** ${ctx.symbols.tomato}
                Maintenance: **${x.maintenance}** ${ctx.symbols.tomato}/day
                Required guild level: **${x.level}**
                > ${x.desc.replace(/{currency}/gi, ctx.symbols.tomato)}`
            }
        })
    })
})

cmd(['store', 'buy'], async (ctx, user, itemid) => {
    const item = ctx.items.filter(x => x.id === itemid && x.price >= 0)[0]

    if(!item)
        return ctx.reply(user, `item with ID \`${itemid}\` not found or cannot be purchased`, 'red')

    if(user.exp < item.price)
        return ctx.reply(user, `you have to have at least \`${item.price}\` ${ctx.symbols.tomato} to buy this item`, 'red')

    return addConfirmation(ctx, user, 
        `Do you want to buy **${item.name} ${item.type}** for **${item.price}** ${ctx.symbols.tomato}?`, null, 
        async (x) => {
            user.inventory.push({ id: item.id, time: new Date() })
            user.exp -= item.price
            await user.save()
            return ctx.reply(user, `you purchased **${item.name} ${item.type}** for **${item.price}** ${ctx.symbols.tomato}
                The item has been added to your inventory. See \`->inv info ${item.id}\` for details`, 'green')
        }, async (x) => {
            return ctx.reply(user, `the purchase was declined`, 'red')
        })
})
