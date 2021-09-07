const {model, Schema} = require('mongoose')

module.exports = model('Transaction', {
    id:             { type: String },

    from:           { type: String },
    from_id:        { type: String },

    to:             { type: String },
    to_id:          { type: String },

    guild:          { type: String },
    guild_id:       { type: String },

    status:         { type: String },
    time:           { type: Date },

    cards:          { type: Array, default: [] },
    price:          { type: Number, default: 0 }
})