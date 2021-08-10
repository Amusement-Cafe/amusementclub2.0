const {model, Schema} = require('mongoose')

module.exports = model('Plots', {
    guild_id:       { type: String, index: true },
    user_id:        { type: String, index: true },
    guild_name:     { type: String },
    building:       {
        install_date:   { type: Date   },
        last_collected: { type: Date   },
        id:             { type: String },
        level:          { type: Number },
        stored_lemons:  { type: Number }
    },
})
