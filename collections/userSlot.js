const {model, Schema} = require('mongoose')

module.exports = model('UserSlot', {
    discord_id:         { type: String, index: true },
    effect_name:        { type: String, default: null },

    slot_expires:       { type: Date, default: null },
    cooldown:           { type: Date, default: null },

    is_active:          { type: Boolean, default: true }
})
