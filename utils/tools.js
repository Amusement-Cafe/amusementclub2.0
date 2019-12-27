const cap = (str) => {
    return str.split(' ').map(s => s[0].toUpperCase() + s.slice(1).toLowerCase()).join(' ')
}

const claimCost = (user, amount) => {
    return ((user.dailystats.claim || 0) + amount) * 50
}

const tryGetUserID = (inp) => {
    inp = inp.trim()

    try {
        if (/^\d+$/.test(inp) && inp > (1000 * 60 * 60 * 24 * 30 * 2 ** 22)){
            return inp;
        } else {
            return inp.slice(0, -1).split('@')[1].replace('!', '');
        }
    }
    catch(err) { }

    return false
}

const getAllUserIDs = (args) => {
	const out = { ids: [], args: [] }
	args.map(x => {
		const id = tryGetUserID(x)
		if(id) out.ids.push(id)
		else out.args.push(x)
	})

	return out
}

module.exports = {
    cap,
    claimCost,
    tryGetUserID,
    getAllUserIDs
}
