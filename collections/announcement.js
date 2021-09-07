const {model, Schema} = require('mongoose')

module.exports = model('Announcement', {
    date:       { type: Date },
    title:      { type: String, default: 'Announcement' },
    body:       { type: String, default: '' },
    notify:     { type: Boolean, default: true },
})
