const {model, Schema} = require('mongoose')

module.exports = model('Cardinfo', {
    id:             { type: Number },

    ratingsum:      { type: Number, default: 0 },
    usercount:      { type: Number, default: 0 },

    aucprices:      { type: Array, default: [] },
})