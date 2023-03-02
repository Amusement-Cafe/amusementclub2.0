const { 
    BattleProfile,
    CardStats,
} = require('../collections')
const user = require('../collections/user')

const fetchOrCreateBP = async (ctx, user) => {
    let battleProfile = await BattleProfile.findOne({ user: user.discord_id })

    if(!battleProfile) {
        battleProfile = new BattleProfile()
        battleProfile.user = user.discord_id
        await battleProfile.save()
    }
    
    return battleProfile
}

const fetchOrCreateCardStats = async (ctx, user, card) => {
    let cardStats = await CardStats.findOne({ user_id: user.discord_id, card_id: card.id })

    if(!cardStats) {
        cardStats = new CardStats()
        cardStats.user_id = user.discord_id
        cardStats.card_id = card.id
        await cardStats.save()
    }
    
    return cardStats
}

const fetchCardStats = async (ctx, user, cardIds) => {
    let cardStats = await CardStats.find({ user_id: user.discord_id, card_id: { $in: cardIds } })
    return cardStats;
}

const fetchUserBattleCards = (ctx, user) => CardStats.find({ user_id: user.discord_id })

const joinOrCreateMatch = async (ctx, user) => {

}

const formatStats = (ctx, battleCard) => {
    return Object.keys(battleCard.stats).map(x => `${ctx.symbols[x]} **${x === 'hp'? 100 + battleCard.stats[x] * 100 : battleCard.stats[x]}**`)
}

const sortStats = (ctx, cardStats, parsedargs) => {
    const stat = parsedargs.battleSort
    const asc = parsedargs.sortAsc
    cardStats.sort((a, b) => (b.stats[stat] - a.stats[stat]) * (asc? -1 : 1))
}

module.exports = {
    fetchOrCreateBP,
    fetchOrCreateCardStats,
    fetchCardStats,
    formatStats,
    sortStats,
    fetchUserBattleCards,
    joinOrCreateMatch,
}
