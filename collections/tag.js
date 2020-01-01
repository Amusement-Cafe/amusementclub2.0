const {model, Schema} = require('mongoose')

module.exports = model('Tag', {
    name:           { type: String },

    author:         { type: String },
    card:           { type: Number, default: -1 },

    upvotes:        [],
    downvotes:      [],
})