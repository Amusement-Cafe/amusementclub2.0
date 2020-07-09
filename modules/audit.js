
const paginate_auditReports = (ctx, user, list, report) => {
    const pages = []
    switch (report) {

        case 2:
            list.map((t, i) => {
                if (i % 10 == 0) pages.push("")
                pages[Math.floor(i/10)] += `${format_overPrice(ctx, user, t)}\n`
            })
            break
        case 3:
            list.map((t, i) => {
                if (i % 10 == 0) pages.push("")
                pages[Math.floor(i/10)] += `${format_rebuys(ctx, user, t)}\n`
            })
            break
    }

    return pages;
}

const format_overPrice = (ctx, user, auc) => {
    let resp = ""

    resp += `**${auc.id}** sold \`${auc.card}\` for ${auc.price_over.toLocaleString('en-us', {minimumFractionDigits: 0})}x eval of ${auc.eval} with ${auc.price} finishing in ${auc.bids} bids`

    return resp;
}

const format_rebuys = (ctx, user, auc) => {
    let resp = ""

    resp += `${auc.user} sold ${auc.card} on auction at \`${auc.id}\` for ${auc.price} and bought it back for ${auc.transprice} at ${auc.transid} `

    return resp;
}

module.exports = {
    paginate_auditReports,
}
