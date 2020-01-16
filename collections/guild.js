const {model, Schema} = require('mongoose')

module.exports = model('Guild', {
    id:             { type: String },
    prefix:         { type: String, default: '->' },
    xp:             { type: Number, default: 0 },
    tax:            { type: Number, default: 0 },
    balance:        { type: Number, default: 0 },
    buildperm:      { type: Number, default: 1 },
    botchannels:    { type: Array, default: [] },

    userstats:      [{
        id:             { type: String },
        xp:             { type: Number, default: 0 },
        rank:           { type: Number, default: 0 },
    }],

    buildings:      [{
        id:             { type: String },
        level:          { type: Number, default: 1 },
        health:         { type: Number, default: 100 },
    }],

    nextcheck:      { type: Date, default: new Date() },
    reportchannel:  { type: String },
})