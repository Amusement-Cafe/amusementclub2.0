const {model, Schema} = require('mongoose')

module.exports = model('Kofi', {
    transaction_id: { type: String, index: true },
    url:            { type: String },
    type:           { type: String },

    amount:         { type: Number },

    timestamp:      { type: Date }
})
