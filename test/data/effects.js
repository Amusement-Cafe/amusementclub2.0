module.exports = [
    {
        id: 'tohrugift',
        name: 'Gift From Tohru',
        desc: 'Get 3-star card every first claim per day',
        passive: true,
        check: (ctx, user) => {
            return !user.dailystats.claims || user.dailystats.claims === 0
        }
    }
]