const {model, Schema} = require('mongoose')

module.exports = model('UserEffect', {
    userid:         { type: String, index: true },
    id:             { type: String },

    uses:           { type: Number },

    cooldownends:   { type: Date },
    expires:        { type: Date },

    notified:       { type: Boolean, default: true },
})
