const fs = require('fs')



/*
This file/script is for if you are NOT using ayano to run the bot.
If you ARE using ayano, use the other configMigration file
 */

const configPath =  '../test/config.json'
const oldConfigPath = '../test/config-old.json'

const main = async () => {
    fs.rename(configPath, oldConfigPath, (err) => {{
        if (err) throw err
        console.log('Renamed config, creating a new one')
    }})
    const old = require(oldConfigPath)
    const newConfig = {
        analytics: {
            mixpanel: old.analytics.mixpanel || ""
        },
        auction: {
            auctionFeePercent: 10,
            auto: {
                count: old.autoAuction.auctionCount || 100,
                multiplier: old.autoAuction.auctionMultiplier || 0.9,
                length: old.autoAuction.auctionLength || 12,
                userID: old.autoAuction.auctionUserID || ""
            },
            lock: old.auctionLock || false
        },
        bot: {
            token: old.token || "",
            shards: old.shards || 1,
            prefix: old.prefix || '/',
            database: old.database || "",
            invite: old.invite || "",
            maintenance: true,
            debug: true,
            adminGuildID: old.adminGuildID || ""
        },
        channels: {
            tagLog: old.auditc.taglogchannel || "",
            guildLog: old.guildLogChannel || "",
            evalUpdate: old.evalc.aucEval.evalUpdateChannel || "",
            report: ""
        },
        effects: {
            uniqueFrequency: old.uniqueFrequency || 10
        },
        evals: {
            auction: {
                minSamples: old.evalc.aucEval.minSamples || 4,
                maxSamples: old.evalc.aucEval.maxSamples || 16,
                minBounds: old.evalc.aucEval.minBounds|| 0.5,
                maxBounds: old.evalc.aucEval.maxBounds|| 5.0,
                aucFailMultiplier: old.evalc.aucEval.aucFailMultiplier|| 0.90
            },
            cardPrices: old.evalc.cardPrices || [ 30, 80, 150, 400, 1000, 2500 ],
            evalUserRate: old.evalc.evalUserRate|| 0.25,
            evalVialRate: old.evalc.evalVialRate|| 0.055
        },
        links: {
            baseurl: old.baseurl|| "https://amusementclub.nyc3.digitaloceanspaces.com",
            shorturl: old.shorturl|| "https://amuse.noxc.dev",
            topggUrl: old.dbl.topggUrl|| "",
            dblUrl: old.dbl.dblUrl|| "",
            kofi: ""
        },
        rng: {
            legendary: 0.001
        },
        sourcing: {
            sauceNaoToken: old.metac.sauceNaoToken|| ""
        },
        symbols: {
            tomato: `🍅`,
            vial: `🍷`,
            lemon: `🍋`,
            star: "★",
            auc_sbd: "🔹",
            auc_lbd: "🔷",
            auc_sod: "🔸",
            auc_wss: "▫️",
            accept: "✅",
            decline: "❌",
            red_circle: `🔴`,
            amu_plus: "➕"
        }
    }

    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2))
    console.log(`Finished transferring the config. If there are any issues you can find your old config at ${oldConfigPath}`)
}

main ()
