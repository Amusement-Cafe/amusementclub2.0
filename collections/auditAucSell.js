const {model, Schema} = require('mongoose')

module.exports = model('AuditAucSell', {
    user:           { type: String },
    name:           { type: String },

    audited:        { type: Boolean, default: false },

    sold:           { type: Number, default: 0 },
    unsold:         { type: Number, default: 0 },

    time:           { type: Date },

})
