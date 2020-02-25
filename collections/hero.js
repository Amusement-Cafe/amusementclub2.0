const {model, Schema} = require('mongoose')

module.exports = model('Hero', {
    id:             { type: String },
    name:           { type: String },
    user:           { type: String },

    accepted:       { type: Boolean, default: false },
    active:         { type: Boolean, default: false },

    submitted:      { type: Date },
    pictures:       { type: Array, default: [] },
})