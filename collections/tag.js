const {model, Schema} = require('mongoose')

module.exports = model('Tag', {
    name:           { type: String },

    author:         { type: String, default: 0 },
    card:           { type: Number, default: -1 },

    upvotes:        { type: Array, default: [] },
    downvotes:      { type: Array, default: [] },
    status:         { type: String, default: "clear" },
})