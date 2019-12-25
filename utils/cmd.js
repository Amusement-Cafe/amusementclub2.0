const tree = {
    cmd: {},
    rct: {},
}

const cmd = (...args) => { buildTree(args) }

const pcmd = (perm, ...args) => { buildTree(args, perm) }

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

const buildTree = async(args, perm) => {
    const callback = args.pop()

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
    })
}

const trigger = async (type, ctx, user, args) => {
    let cursor = tree[type]

    while (cursor.hasOwnProperty(args[0])) {
        cursor = cursor[args[0]]
        args.shift()
    }

    if (!cursor.hasOwnProperty('_callback')) {
        //throw new Error(`Unknown command name, please try again, or use ${prefix}help`)
    }

    if (cursor._perm) {
        if(!user.roles || !cursor._perm.filter(x => user.roles.filter(y => x === y)[0])[0])
            throw new Error(`Only users with roles **[${cursor._perm}]** can execute this command`)
    }

    const newArgs = [ctx, user || { }].concat(args)

    try {
        return await cursor._callback.apply({}, newArgs)
    } catch (err) {
        console.error(err) /* log actual error to the console */
        throw new Error(err)
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

