const cap = (str) => {
	return str.split(' ').map(s => s[0].toUpperCase() + s.slice(1).toLowerCase()).join(' ')
}

const claimCost = (user, amount) => {
	return (user.dailystats.claim + amount) * 50
}

module.exports = {
    cap, claimCost
}