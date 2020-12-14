const {model, Schema} = require('mongoose')

module.exports = model('Cardinfo', {
    id:             { type: Number, index: true },

    ratingsum:      { type: Number, default: 0 },
    usercount:      { type: Number, default: 0 },
    ownercount:     { type: Number, default: -1 },

    aucprices:      { type: Array, default: [] },
})