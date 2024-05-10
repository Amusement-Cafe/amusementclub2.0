const {mod}         = require('../utils/cmd')
const Announcement  = require("../collections/announcement")
const colors        = require("../utils/colors")
const {fetchOnly}   = require('./user')

mod('sudoAnnounce', async (ctx, user) => {
    const announcement = new Announcement()
    announcement.date = new Date()
    announcement.title = ctx.args.find(x => x.customID === 'announceTitle').value
    announcement.body = ctx.args.find(x => x.customID === 'announceBody').value
    await announcement.save()
    return ctx.reply(user, `announcement has been created!
    Title: **${announcement.title}**
    Body: \`\`\`${announcement.body}\`\`\``)
})

mod('report', async (ctx, user) => {
    ctx.sendCfm(ctx, user, {
        question: `You are about to submit a report stating:\n\`\`\`${ctx.args.find(x => x.customID === 'reportBody').value}\`\`\`
        Are you sure you want to submit this? 
        Please note that false reports or spamming using this feature may get you blocked from reporting`,
        onConfirm: async () => {
            await ctx.bot.rest.channels.createMessage(ctx.reportChannel, {
                embeds: [
                    {
                        footer: {
                        text: user.discord_id
                        },
                        description: ctx.args.find(x => x.customID === 'reportBody').value,
                        color: colors.yellow,
                        title: ctx.args.find(x => x.customID === 'reportTitle')?.value
                    }]})
            ctx.reply(user, `report submitted!`, 'green', true)
        }
    })
})

mod('auditWarn', async (ctx, user) => {
    const body = ctx.args.find(x => x.customID === 'warnBody').value
    const userID = ctx.args.find(x => x.customID === 'warnUser').value
    let warnedUser = await fetchOnly(userID)
    if (!warnedUser)
        return ctx.reply(user, `user with ID ${userID} not found`, 'red')

    ctx.sendCfm(ctx, user, {
        question: `You are about to warn the users with IDs **${userID}**
        By clicking confirm these messages will be sent, are you sure?
        Message Preview:
        ${body}`,
        onConfirm: async () => {
            let embed = {
                title: "**Rule Violation Warning**",
                description: body
            }
            try {
                await ctx.direct(warnedUser, embed, 'yellow')
            } catch (e) {
                return ctx.reply(user, `insufficient permissions to send a DM message. Warning message not sent.`, 'red', true)
            }
            ctx.reply(user, {
                title: `Warning sent to ${userID}`,
                description: `Warning message:\n\n` + body
            }, 'green', true)

        }
    })
})
