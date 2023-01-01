**Amusement Club** is a global gacha game for Discord with thousands of cute and fancy cards made by the bot's community. You can get started on any server by typing `/claim cards` in a bot channel. 

Each claim will cost you more 🍅 tomatoes (in-game currency) `/daily` will reset your claim cost and give you extra tomatoes.

- If you are new, [get started here](https://docs.amusement.cafe/en/getting-started/howto-play)
- For setting up bot on your server check out [this page](https://docs.amusement.cafe/en/getting-started/server)
- If you are upgrading from previous version, check out [this guide](https://docs.amusement.cafe/en/upgrade)

Invite bot [here](https://club.amusement.cafe).
Get your bot issues resolved on [Amusement Cafe](https://discord.gg/xQAxThF) support server.

[![Discord Server](https://img.shields.io/discord/351871492536926210)](https://discord.gg/xQAxThF)

## Contributing

After cloning this repository you can run the bot in development mode. Under `test/` you can find sample data and a startup script. Please DO NOT commit any changes to those files. 

- Copy `test/config.dest.json` and remove the `.dest` to `test/config.json`
- Open `test/config.json` with your preferred text editor and set your bot `token` and `database` url (if it is different on your system). By default, the bot will access cards from the Amusement Club CDN.
- Open Terminal or PowerShell and run `npm i` to install all dependencies.
- Run `npm i -g nodemon`.
- Run `npm start` to start the bot. Every time you run bot directly (without using Ayano) it will run in development mode.

Test out your features and when you are ready make a Pull Request into the feature branch (e.g. `bort`).

## Hosting

Before starting, please do all starting steps from **contributing** stage.

Make sure you are not violating anything in the **LICENSE** when you are hosting. You **must** mention that parts of your bot are licensed under **MPL-2.0** on the help/info page of your bot like this:
> Parts of the project are licensed under the MPL-2.0 and can be obtained here: https://github.com/Amusement-Cafe/amusementclub2.0/

To host your bot on the small amount of servers, you can just run bot in development mode. However if you need sharding and card management support, consider using [Ayano](https://github.com/Amusement-Cafe/ayano).
