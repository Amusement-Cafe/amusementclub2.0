
const paginate_overPrice = (ctx, user, list) => {
    const pages = []
    list.map((t, i) => {
        if (i % 10 == 0) pages.push("")
        pages[Math.floor(i/10)] += `${format_overPrice(ctx, user, t)}\n`
    })

    return pages;
}

const format_overPrice = (ctx, user, auc) => {
    let resp = ""

    resp += `**${auc.id}** sold \`${auc.card}\` for ${auc.price_over.toLocaleString('en-us', {minimumFractionDigits: 0})}x eval of ${auc.eval} with ${auc.price} finishing in ${auc.bids} bids`

    return resp;
}

const paginate_rebuys = (ctx, user, list) => {
    const pages = []
    list.map((t, i) => {
        if (i % 10 == 0) pages.push("")
        pages[Math.floor(i/10)] += `${format_rebuys(ctx, user, t)}\n`
    })

    return pages;
}

const format_rebuys = (ctx, user, auc) => {
    let resp = ""
    console.log(auc)
    resp += `${auc.user} sold ${auc.card} on auction at \`${auc.id}\` for ${auc.price} and bought it back for ${auc.transprice} at ${auc.transid} `

    return resp;
}

module.exports = {
    paginate_overPrice,
    paginate_rebuys,
}
