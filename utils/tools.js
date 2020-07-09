const cap = (str) => {
    return str.split(' ').map(s => s[0].toUpperCase() + s.slice(1).toLowerCase()).join(' ')
}

const claimCost = (user, tax, amount, totalClaims) => {
    let total = 0
    let claims = totalClaims || user.dailystats.claims || 0
    for (let i = 0; i < amount; i++) {
        claims++
        total += claims * 50
    }

    return Math.round(total + total * tax)
}

const promoClaimCost = (user, amount, totalClaims) => {
    let total = 0
    let claims = totalClaims || user.dailystats.promoclaims || 0
    for (let i = 0; i < amount; i++) {
        claims++
        total += claims * 50
    }

    return Math.round(total)
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

const nameSort = (a, b, prop = "name") => {
    if(a[prop] < b[prop]) return -1;
    if(a[prop] > b[prop]) return 1;
    return 0;
}

const generateNextId = (lastId, idLength = 4) => {
    if(lastId.length != idLength)
        throw new Error(`Last ID '${lastId}' length should be same as requested length '${idLength}'`)

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

//const XPtoLEVEL = (xp) => xp === 0? 0 : Math.max(Math.floor((Math.log(xp) / Math.log(5)) * Math.sqrt(xp) * .75), 0)
const XPtoLEVEL = (xp) => Math.floor(Math.sqrt(xp * 2))

const arrayChunks = (array, chunk_size) => Array(Math.ceil(array.length / chunk_size)).fill().map((_, index) => index * chunk_size).map(begin => array.slice(begin, begin + chunk_size));

module.exports = {
    cap,
    claimCost,
    promoClaimCost,
    nameSort,
    tryGetUserID,
    getAllUserIDs,
    generateNextId,
    XPtoLEVEL,
    arrayChunks
}
