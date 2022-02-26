const {model, Schema} = require('mongoose')

module.exports = model('Audit', {
    audit_id:       { type: String },
    id:             { type: String },
    transid:        { type: String },
    user:           { type: String },
    closedBy:       { type: String },

    audited:        { type: Boolean, default: false },

    bids:           { type: Number, default: 0 },
    price:          { type: Number, default: 0 },
    transprice:     { type: Number, default: 0 },
    eval:           { type: Number, default: 0 },
    price_over:     { type: Number, default: 0 },
    report_type:    { type: Number, default: 0 },
    card:           [],

    time:           { type: Date, default: Date.now },

})
