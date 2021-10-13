const {model, Schema} = require('mongoose')

module.exports = model('Cardinfo', {
    id:             { type: Number, index: true },

    ratingsum:      { type: Number, default: 0 },
    usercount:      { type: Number, default: 0 },
    ownercount:     { type: Number, default: -1 },

    meta:           {
                        booruid:        { type: Number },
                        booruscore:     { type: Number },
                        boorurating:    { type: String },
                        
                        artist:         { type: String },
                        pixivid:        { type: String },
                        source:         { type: String },
                        image:          { type: String },

                        added:          { type: Date },
                        author:         { type: String },
                        contributor:    { type: String },
                    },

    aucevalinfo:    {
                        newaucprices:   { type: Array, default: [] },
                        evalprices:     { type: Array, default: [] },
                        auccount:       { type: Number, default: 0 },
                        lasttoldeval:   { type: Number, default: -1 },
                    },
})
