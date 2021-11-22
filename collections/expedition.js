const {model, Schema} = require('mongoose')

module.exports = model('Expedition', {
    user:           { type: String, index: true },
    hero:           { type: Number },
    finished:       { type: Boolean, default: false, index: true },

    type:           { type: Number, default: 0 },
    started:        { type: Date, default: new Date() },
    finishes:       { type: Date, default: new Date() },

    gain:           {
                        green: { type: Number, default: 0 },
                        purple: { type: Number, default: 0 },
                        yellow: { type: Number, default: 0 },
                    }
})