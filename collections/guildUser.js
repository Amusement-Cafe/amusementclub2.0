const {model, Schema} = require('mongoose')

module.exports = model('GuildUser', {
    userid:     { type: String, index: true },
    guildid:    { type: String, index: true },

    xp:         { type: Number, default: 0 },
    level:      { type: Number, default: 0 },
    donated:    { type: Number, default: 0 },
    roles:      { type: Array, default: [] },
})
