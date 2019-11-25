const {cmd} = require('../utils/cmd')

cmd('help', ({ rpl }, user, { channel }) => {
    rpl(channel.id, user, 'here is some help for you: **no**')
})
