const {model, Schema} = require('mongoose')

module.exports = model('Match', {
    guild_id:       { type: String, index: true },
    user_id:        { type: String, index: true },
    guild_name:     { type: String },
    next_check:     { type: Date, default: new Date() },
    building:       {
        install_date:   { type: Date   },
        last_collected: { type: Date   },
        id:             { type: String },
        level:          { type: Number },
        stored_lemons:  { type: Number }
    },

    users:      [ { type: String } ],
    round:      { type: Number, default: 0 },
    starts:     { type: Date }
})
