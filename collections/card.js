const {model, Schema} = require('mongoose')

module.exports = model('Card', {
    name:           { type: String },
    col:            { type: String },

    level:          { type: Number },

    animated:       { type: Boolean },
    craft:          { type: Boolean },
})
