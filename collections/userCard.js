const {model, Schema} = require('mongoose')

module.exports = model('UserCard', {
    userid:         { type: String, index: true },
    cardid:         { type: Number, index: true },

    fav:            { type: Boolean, default: false },
    amount:         { type: Number, default: 1 },
    rating:         { type: Number, default: 0 },
    obtained:       { type: Date, default: Date.now },
})