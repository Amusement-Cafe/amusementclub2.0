const { BattleProfile } = require("../collections")

const fetchOrCreateBP = async (ctx, user) => {
    let battleProfile = await BattleProfile.findOne({ user: user.discord_id })

    if(!battleProfile) {
        battleProfile = new BattleProfile()
        battleProfile.user = user.discord_id
        await battleProfile.save()
    }
    
    return battleProfile
}

module.exports = {
    fetchOrCreateBP,
}
