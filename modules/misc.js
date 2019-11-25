const {cmd} = require('../utils/cmd')

cmd('help', ({ rpl }, user) => {
    rpl(user, 'Here is some help for you: **no**')
})
