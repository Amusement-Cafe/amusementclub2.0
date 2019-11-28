const {model, Schema} = require('mongoose')

module.exports = model('Collection', {
    id:           	{ type: String },
    name:          	{ type: String },
    origin:      	{ type: String },

    aliases:      	[ { type: String } ],

    special:       	{ type: Boolean, default: false },
    compressed: 	{ type: Boolean, default: true },
})
