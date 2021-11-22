const {model, Schema} = require('mongoose')

module.exports = model('BattleProfile', {
    user:           { type: String, index: true },

    inv:            {
                        green: { type: Number, default: 0 },
                        purple: { type: Number, default: 0 },
                        yellow: { type: Number, default: 0 },
                    }
})