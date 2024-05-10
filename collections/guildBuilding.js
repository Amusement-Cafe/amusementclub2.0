const {model, Schema} = require('mongoose')

module.exports = model('Guildbuilding', {
    guildid:    { type: String, index: true },
    id:         { type: String },

    level:      { type: Number, default: 1 },
    health:     { type: Number, default: 100 }
})
