const {model, Schema} = require('mongoose')

module.exports = model('Promo', {
    id:             { type: String },
    name:           { type: String },
    currency:       { type: String },

    isboost:        { type: Boolean, default: false },
    cards:          { type: Array, default: [] },

    starts:         { type: Date },
    expires:        { type: Date },
})