const {model, Schema} = require('mongoose')

module.exports = model('User', {
    discord_id:         { type: String, index: true },
    username:           { type: String },

    exp:                { type: Number, default: 0, index: true },
    promoexp:           { type: Number, default: 0, index: true },
    joined:             { type: Date },

    lastQueriedCard:    { type: Object },
    dailystats:         {
        claims:         {type: Number, default: 0},
        promoclaims:    {type: Number, default: 0},
        totalregclaims: {type: Number, default: 0},
        bids:           {type: Number, default: 0},
        aucs:           {type: Number, default: 0},
        liquify:        {type: Number, default: 0},
        liquify1:       {type: Number, default: 0},
        liquify2:       {type: Number, default: 0},
        liquify3:       {type: Number, default: 0},
        draw:           {type: Number, default: 0},
        draw1:          {type: Number, default: 0},
        draw2:          {type: Number, default: 0},
        draw3:          {type: Number, default: 0},
        tags:           {type: Number, default: 0},
        forge1:         {type: Number, default: 0},
        forge2:         {type: Number, default: 0},
        forge3:         {type: Number, default: 0},
        rates:          {type: Number, default: 0},
        store3:         {type: Number, default: 0},
    },
    
    effectusecount:     {
        memoryxmas:     {type: Number, default: 0},
        memoryhall:     {type: Number, default: 0},
        memorybday:     {type: Number, default: 0},
        memoryval:      {type: Number, default: 0},
        xmasspace:      {type: Boolean, default: false},
        hallspace:      {type: Boolean, default: false},
        bdayspace:      {type: Boolean, default: false},
        valspace:       {type: Boolean, default: false},
    },

    cards:              { type: Array, default: [] },
    inventory:          { type: Array, default: [] },
    completedcols:      { type: Array, default: [] },
    cloutedcols:        { type: Array, default: [] },
    achievements:       { type: Array, default: [] },
    effects:            { type: Array, default: [] },
    wishlist:           { type: Array, default: [] },

    lastdaily:          { type: Date, default: new Date() },
    lastvote:           { type: Date, default: new Date() },
    lastannounce:       { type: Date, default: new Date() },
    lastmsg:            { type: String },

    dailynotified:      { type: Boolean, default: true },
    votenotified:       { type: Boolean, default: false },

    heroslots:          [
                            { type: String, default: null }
                        ],

    herocooldown:       { type: Array, default: [] },

    hero:               { type: String },
    herochanged:        { type: Date },
    herosubmits:        { type: Number, default: 0 },

    roles:              { type: Array, default: [] },
    ban:                {
        full:           {type: Boolean},
        embargo:        {type: Boolean},
        tags:           {type: Number}
    },

    lastcard:           { type: Number, default: -1 },
    xp:                 { type: Number, default: 0, index: true },
    vials:              { type: Number, default: 0, index: true },
    lemons:             { type: Number, default: 0, index: true },
    votes:              { type: Number, default: 0 },

    dailyquests:        { type: Array, default: [] },
    questlines:         { type: Array, default: [] },

    prefs:              {
        notifications:  {
            aucbidme:   { type: Boolean, default: true },
            aucoutbid:  { type: Boolean, default: true },
            aucnewbid:  { type: Boolean, default: false },
            aucend:     { type: Boolean, default: true },
            announce:   { type: Boolean, default: false },
            daily:      { type: Boolean, default: false },
            vote:       { type: Boolean, default: false },
            completed:  { type: Boolean, default: true },
        },
    }
})
