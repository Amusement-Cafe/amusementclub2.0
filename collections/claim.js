const {model, Schema} = require('mongoose')

module.exports = model('Claim', {
    id:             { type: String, default: "aaaaaa", index: true },

    user:           { type: String, index: true },
    guild:          { type: String },
    cards:          [{ type: Number }],

    cost:           { type: Number },
    promo:          { type: Boolean, default: false },
    lock:           { type: String, default: "" },

    date:           { type: Date, default: Date.now },
})
