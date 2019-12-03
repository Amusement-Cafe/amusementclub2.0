const {model, Schema} = require('mongoose')

module.exports = model('User', {
    discord_id:         { type: String },
    username:           { type: String },

    exp:                { type: Number, default: 0 },
    promoexp:           { type: Number, default: 0 },

    lastQueriedCard:    { type: Object },
    dailystats:         { type: Object, default: {} },

    cards:              [],
    quests:             [],

    lastdaily:          { type: Date, default: Date.now() },
    lastmsg:            { type: String },
})
