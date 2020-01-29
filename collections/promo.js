const {model, Schema} = require('mongoose')

module.exports = model('Promo', {
    id:             { type: String },
    name: 			{ type: String },

    isboost:       	{ type: Boolean, default: false },
    cards:          { type: Array, default: [] },

    expires:        { type: Date },
})