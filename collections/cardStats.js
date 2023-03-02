const {model, Schema} = require('mongoose')

module.exports = model('CardStats', {
    user_id:        { type: String, index: true },
    card_id:        { type: Number, index: true },

    level:          { type: Number, default: 0 },

    stats:          {
                        atk:    { type: Number, default: 0 },
                        def:    { type: Number, default: 0 },
                        chance: { type: Number, default: 0 },
                        hp:     { type: Number, default: 0 },
                    }
})
