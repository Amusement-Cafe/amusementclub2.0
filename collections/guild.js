const {model, Schema} = require('mongoose')

module.exports = model('Guild', {
    id:             { type: String },
    prefix:         { type: String, default: '->' },
    xp:             { type: Number, default: 0 },
    botchannels:    [],
})