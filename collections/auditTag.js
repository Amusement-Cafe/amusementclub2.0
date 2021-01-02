const {model, Schema} = require('mongoose')

module.exports = model('TagAuditLog', {
    commandRunner:           { type: String },
    affectedUser:            { type: String },
    message_id:              { type: String },

    tagsBanned:              [],
    tagsRemoved:             [],

    last_edited:            { type: Date },

})
