const User = require('../collections/user')

const cardPrices = [ 0, 80, 150, 400, 1000 ]
const evalUserRate = 0.5
const evalLastDaily = new Date();

evalLastDaily.setMonth(evalLastDaily.getMonth() - 6);

const evalCard = async (ctx, card, modifier = 1) => {
    if(card.hasOwnProperty('eval'))
        return card.eval

    const userCount = await User.estimatedDocumentCount()
    const amount = await User.countDocuments({
        cards: { $elemMatch: { id: card.id }}, 
        lastdaily: { $gt: evalLastDaily }})

    return Math.round(((cardPrices[card.level] + (card.animated? 100 : 0))
    	* limitPriceGrowth((userCount * evalUserRate) / amount)) * modifier)
}

const limitPriceGrowth = x => { 
    if(x<1) return x; 
    else if(x<10) return (Math.log(x)/1.3)+Math.sqrt(x)*(-0.013*Math.pow(x,2)+0.182*x+0.766); 
    else return Math.pow(x,0.2) + 4.25;
}

module.exports = {
	evalCard
}