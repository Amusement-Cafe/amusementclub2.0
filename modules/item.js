const itemInfo = (item) => { return {
    author: { name: item.name },
    description: item.fulldesc,
    color: colors.deepgreen
}}

const blueprintInfo = (item) => {
    let info = itemInfo(item)
    info.fields = item.levels.map((x, i) => { 
        return {
        name: `Level ${i + 1}`, 
        value: `Price: **${x.price}** {currency}
            Maintenance: **${x.maintenance}** {currency}/day
            Required guild level: **${x.level}**
            > ${x.desc}`
        }
    })

    return info
}

const mapUserInventory = (ctx, user) => {
    return user.inventory.map(x => Object.assign({}, ctx.items.filter(y => y.id === x.id)[0], x))
}

/**
 * Helper function to enrich the comamnd with user items
 * @param  {Function} callback command handler
 * @return {Promise}
 */
const withUserItems = (callback) => (ctx, user, ...args) => {
    if (user.inventory.length == 0) 
        return ctx.reply(user, 'your inventory is empty', 'red')

    let items = mapUserInventory(ctx, user)

    if(args[0]) {
        const reg = new RegExp(args[0], 'gi')
        items = items.filter(x => reg.test(x.id))
    }

    if(items.length == 0)
        return ctx.reply(user, `no items found`, 'red')

    return callback(ctx, user, items, args)
}

module.exports = {
    itemInfo,
    mapUserInventory,
    withUserItems
}
