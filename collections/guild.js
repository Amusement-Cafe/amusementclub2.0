const {model, Schema} = require('mongoose')

module.exports = model('Guild', {
    id:             { type: String, index: true },
    prefix:         { type: String, default: '->' },
    xp:             { type: Number, default: 0 },
    tax:            { type: Number, default: 0 },
    balance:        { type: Number, default: 0 },
    lemons:         { type: Number, default: 0 },
    buildperm:      { type: Number, default: 1 },
    botchannels:    { type: Array, default: [] },

    userstats:      [{
        id:             { type: String },
        xp:             { type: Number, default: 0 },
        rank:           { type: Number, default: 0 },
        roles:          { type: Array, default: [] },
    }],

    buildings:      [{
        id:             { type: String },
        level:          { type: Number, default: 1 },
        health:         { type: Number, default: 100 },
    }],

    nextcheck:      { type: Date, default: new Date() },
    reportchannel:  { type: String },
    lastcmdchannel: { type: String },
    overridelock:   { type: String, default: '' },
    lock:           { type: String, default: '' },
    lockactive:     { type: Boolean, default: false },
    processing:     { type: Boolean, default: false },
    lastlock:       { type: Date, default: new Date(0) },
    discount:       { type: Number, default: 0 },

    hero:           { type: String, default: '' },
    heroloyalty:    { type: Number, default: 0 },
})
