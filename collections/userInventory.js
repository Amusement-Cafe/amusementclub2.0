const {model, Schema} = require('mongoose')

module.exports = model('UserInventory', {
    userid:         { type: String, index: true },
    id:             { type: String },
    col:            { type: String },

    acquired:       { type: Date },

    cards:          { type: Array }
})
