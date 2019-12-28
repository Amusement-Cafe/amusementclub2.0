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

const generateNextId = (lastId, idLength = 4) => {
    // The digits in the space are aliased by these characters:
    const charPool = ['a','b','c','d','e','f','g','h','i','j','k','m',
            'n','o','p','q','r','s','t','u','v','w','x','y','z'];
    const base = charPool.length;

    // Translate the last ID from our custom character pool to its corresponding
    // numeric value in the correct base.
    let lastNum = "";
    for (let i=0; i<idLength; i++) {
        lastNum += charPool.indexOf(lastId[i]).toString(base);
    }
  
    // Switch to Base 10 and add our custom increment to get the next ID.
    // If the size of charPool changes, make sure "increment" is
    // relatively prime with the new base.
    lastNum = parseInt(lastNum, base);
    const increment = 3*Math.pow(base,3) + 11*Math.pow(base,2) + 9*base + 21;
    let nextNum = (lastNum + increment) % Math.pow(base, idLength);

    // switch back to designated base
    nextNum = nextNum.toString(base);

    // Pad the number with zeroes so we always get the correct length.
    const nextNumStr = ("0".repeat(idLength) + nextNum).substr((-1)*idLength,idLength);

    // Translate from the designated base to our custom character pool.
    let nextId = "";
    for (var i=0; i<idLength; i++)
        nextId += charPool[parseInt(nextNumStr[i], base)];
    return nextId;
}

module.exports = {
    cap,
    claimCost,
    tryGetUserID,
    getAllUserIDs,
    generateNextId
}
