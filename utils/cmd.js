const tree = {
    cmd: {},
    rct: {},
}

const cmd = (...args) => buildTree(args)

const pcmd = (perm, ...args) => buildTree(args, perm)

const rct = (...args) => {
    const callback = args.pop()
    const cursor = tree.rct

    args.map(alias => {
        if (!cursor.hasOwnProperty(alias)) {
            cursor[alias] = {}
        }

        cursor[alias]._callback = callback
    })
}

const buildTree = (args, perm) => {
    const callback = args.pop()
    const cursors = []

    args.map(alias => {
        let sequence = Array.isArray(alias) ? alias : [alias]
        let cursor = tree.cmd

        sequence.map(arg => {
            if (!cursor.hasOwnProperty(arg)) {
                cursor[arg] = {}
            }

            cursor = cursor[arg]
        })

        cursor._callback = callback

        if(perm)
            cursor._perm = perm

        cursors.push(cursor)
    })

    const chain = {
        access: (arg) => {
            cursors.map(x => {
                x._access = arg
            })
            return chain
        }
    }

    return chain
}

const trigger = async (type, ctx, user, args) => {
    let cursor = tree[type]

    while (cursor.hasOwnProperty(args[0])) {
        cursor = cursor[args[0]]
        args.shift()
        ctx.capitalMsg.shift()
    }

    if (!cursor.hasOwnProperty('_callback')) {
        return ctx.reply(user, `unknown command. Please check your spelling or use help`, 'red')
    }

    if (cursor._perm) {
        if(!user.roles || !cursor._perm.find(x => user.roles.some(y => x === y)))
            return ctx.reply(user,`only users with roles **[${cursor._perm}]** can execute this command`, 'red')
    }

    if(!ctx.guild && cursor._access != 'dm') {
        return ctx.reply(user, `this command is possible only in guild (server) channel`, 'red')
    }

    const newArgs = [ctx, user || { }].concat(args)

    try {
        return await cursor._callback.apply({}, newArgs)
    } catch (err) {
        console.error(err) /* log actual error to the console */
        throw (err)
    }
}

module.exports = {
    cmd,
    pcmd,
    rct,
    trigger,
}

/* testing */

// cmd('help', async (...args) => {
//     console.log('help', args)
// })

// cmd('help', 'tomato', async (...args) => {
//     console.log('help', 'tomato', args)
// })

// trigger(['help', 1, 2, 3])
// trigger(['help', 'francesca', 2, 3])
// trigger(['help', 'tomato', 1, 2, 3])

