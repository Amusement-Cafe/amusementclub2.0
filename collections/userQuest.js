const {model, Schema} = require('mongoose')

module.exports = model('UserQuest', {
    userid:         { type: String, index: true },
    questid:        { type: String },
    type:           { type: String },

    completed:      { type: Boolean, default: false},

    created:        { type: Date },
    expiry:         { type: Date },
})
