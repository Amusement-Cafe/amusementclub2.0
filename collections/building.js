const {model, Schema} = require('mongoose')

module.exports = model('Building', {
    type:       { type: String, index: true },
    user:       { type: String, index: true },
    guild:      { type: String, index: true },

    level:      { type: Number },
})
