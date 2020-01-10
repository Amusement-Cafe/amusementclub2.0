const {model, Schema} = require('mongoose')

module.exports = model('Guild', {
    id:             { type: String },
    prefix:         { type: String, default: '->' },
    xp:             { type: Number, default: 0 },
    buildperm:      { type: Number, default: 1 },
    botchannels:    [],

    userstats:      [{
        id:             { type: String },
        xp:             { type: Number, default: 0 },
        rank:           { type: Number, default: 0 },
    }],

    buildings:      [{
        id:             { type: String },
        level:          { type: Number, default: 1 },
        health:         { type: Number, default: 100 },
    }]
})