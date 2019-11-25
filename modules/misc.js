const {cmd} = require('../utils/cmd')

cmd('help', ({ reply, msg }, user, ...args) => {
    console.log('a user', user.username, 'sent help with args', args, 'in channel:', msg.channel.id)
    reply(user, 'here is some help for you: **no**')
})
