const {cmd} = require('../utils/cmd')

cmd('help', ({ rpl, msg }, user, ...args) => {
    console.log('a user', user.username, 'sent help with args', args, 'in channel:', msg.channel.id)
    rpl(user, 'here is some help for you: **no**')
})
