const fs = require('fs')

/*
This file/script is for if you are using ayano to run the bot.
If you are NOT using ayano, use the other configMigration file
 */

const configPath =  '../../ayano/config.json'
const oldConfigPath = '../../ayano/config-old.json'
const main = async () => {
    fs.rename(configPath, oldConfigPath, (err) => {{
        if (err) throw err
        console.log('Renamed config, creating a new one')
    }})
    const old = require(oldConfigPath)
    const newConfig = {
        grouptimeout: old.grouptimeout || 1000,
        database: old.database || "",
        amusement: {
            analytics: {
                mixpanel: old.shard.analytics.mixpanel || ""
            },
            auction: {
                auctionFeePercent: 10,
                auto: {
                    count: old.shard.autoAuction.auctionCount || 100,
                    multiplier: old.shard.autoAuction.auctionMultiplier || 0.9,
                    length: old.shard.autoAuction.auctionLength || 12,
                    userID: old.shard.autoAuction.auctionUserID || ""
                },
                lock: old.shard.auctionLock || false
            },
            bot: {
                token: old.shard.token || "",
                shards: old.shards || 1,
                prefix: old.shard.prefix || '/',
                invite: old.shard.invite || "",
                maintenance: true,
                debug: true,
                adminGuildID: old.shard.adminGuildID || ""
            },
            channels: {
                tagLog: old.shard.auditc.taglogchannel || "",
                guildLog: old.shard.guildLogChannel || "",
                evalUpdate: old.shard.evalc.aucEval.evalUpdateChannel || ""
            },
            effects: {
                uniqueFrequency: old.shard.uniqueFrequency || 10
            },
            evals: {
                auction: {
                    minSamples: old.shard.evalc.aucEval.minSamples || 4,
                    maxSamples: old.shard.evalc.aucEval.maxSamples || 16,
                    minBounds: old.shard.evalc.aucEval.minBounds|| 0.5,
                    maxBounds: old.shard.evalc.aucEval.maxBounds|| 5.0,
                    aucFailMultiplier: old.shard.evalc.aucEval.aucFailMultiplier|| 0.90
                },
                cardPrices: old.shard.evalc.cardPrices || [ 30, 80, 150, 400, 1000, 2500 ],
                evalUserRate: old.shard.evalc.evalUserRate|| 0.25,
                evalVialRate: old.shard.evalc.evalVialRate|| 0.055
            },
            links: {
                baseurl: old.shard.baseurl|| "https://amusementclub.nyc3.digitaloceanspaces.com",
                shorturl: old.shard.shorturl|| "https://amuse.noxc.dev",
                topggUrl: old.shard.dbl.topggUrl|| "",
                dblUrl: old.shard.dbl.dblUrl|| "",
                kofi: ""
            },
            rng: {
                legendary: 0.001
            },
            sourcing: {
                sauceNaoToken: old.shard.metac.sauceNaoToken|| ""
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
        },
        ayanobot: {
            token: old.ayanobot.token || '',
            prefix: old.ayanobot.prefix || 'ayy',
            reportchannel: old.ayanobot.reportchannel || ''
        },
        aws: {
            endpoint: old.aws.endpoint || 'nyc3.digitaloceanspaces.com',
            bucket: old.aws.bucket || 'amusementclub',
            s3accessKeyId: old.aws.s3accessKeyId || '',
            s3secretAccessKey: old.aws.s3secretAccessKey || '',
            cardroot: old.aws.cardroot || 'cards/'
        },
        webhooks: {
            dbl: {
                token: old.shard.dbl.token || '',
                port: old.shard.dbl.port || '2727',
                pass: old.shard.dbl.pass || ''
            },
            kofi: {
                verification: ''
            }
        }
    }
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2))
    console.log(`Finished transferring the config. If there are any issues you can find your old config at ${oldConfigPath}`)
}

main ()
