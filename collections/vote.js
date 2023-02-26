const {model, Schema} = require('mongoose')

module.exports = model('vote', {
    userid:         { type: String, index: true },
    token:          { type: String, index: true },

    vote:           { type: String },

    generatedat:    { type: Date, default: null },
    votedat:        { type: Date, default: null },
})
