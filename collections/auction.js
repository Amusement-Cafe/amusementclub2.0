const {model, Schema} = require('mongoose')

module.exports = model('Auction', {
    id:             { type: String },

    finished:       { type: Boolean, default: false },
    cancelled:      { type: Boolean, default: false },
    price:          { type: Number, default: 0 },
    highbid:        { type: Number, default: 0 },

    author:         { type: String },
    card:           { type: Number, default: -1 },
    lastbidder:     { type: String },

    bids:           [],

    expires:        { type: Date },
    time:           { type: Date },
    guild:          { type: String },
})
