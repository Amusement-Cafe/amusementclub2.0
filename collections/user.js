const {model, Schema} = require('mongoose')

module.exports = model('User', {
    discord_id:         { type: String, index: true },
    username:           { type: String },

    exp:                { type: Number, default: 0 },
    promoexp:           { type: Number, default: 0 },
    joined:             { type: Date },

    lastQueriedCard:    { type: Object },
    dailystats:         { type: Object, default: {} },

    cards:              { type: Array, default: [] },
    inventory:          { type: Array, default: [] },
    completedcols:      { type: Array, default: [] },
    achievements:       { type: Array, default: [] },
    effects:            { type: Array, default: [] },

    lastdaily:          { type: Date },
    lastmsg:            { type: String },
    heroslots:          { type: Array, default: [] },
    herocooldown:       { type: Array, default: [] },

    hero:               { type: String },
    herochanged:        { type: Date },
    herosubmits:        { type: Number, default: 0 },

    roles:              { type: Array, default: [] },
    ban:                {
        full:           {type: Boolean},
        embargo:        {type: Boolean},
        tags:           {type: Number}
    },

    lastcard:           { type: Number, default: -1 },
    xp:                 { type: Number, default: 0 },
    vials:              { type: Number, default: 0 },

    dailyquests:        { type: Array, default: [] },
    questlines:         { type: Array, default: [] },
})
