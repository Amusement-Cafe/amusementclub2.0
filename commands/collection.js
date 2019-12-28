const {byAlias}             = require('../modules/collection')
const {addPagination}       = require('../utils/paginator')
const {cmd}                 = require('../utils/cmd')
const {nameSort}            = require('../utils/tools')

cmd('col', 'collection', async (ctx, user, ...args) => {
    if(args[0] && args[0][0] === '-')
        args[0].shift()

    console.log(args)
    const filtered = byAlias(ctx, args.join()).sort((a, b) => nameSort(a, b, 'id'))
    console.log(filtered)

    if(filtered.length === 0)
        return ctx.reply(user, `found 0 collections matching \`${args.join(' ')}\``)

    const pages = []
    filtered.map((x, i) => {
        if (i % 10 == 0) pages.push("")
        pages[Math.floor(i/10)] += `**${x.name}** (${x.id})\n`
    })

    return await addPagination(ctx, user, `found ${filtered.length} collections`, pages)
})