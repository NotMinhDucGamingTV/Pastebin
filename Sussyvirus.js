const { ApplicationCommandOptionType } = require("discord.js");
const { LoadType } = require("shoukaku");
const Command = require("../../structures/Command.js");

module.exports = class Playlist extends Command {
  constructor(client) {
    super(client, {
      name: "playlist",
      description: "Manage your playlists (add, create, delete, load)",
      category: "playlist",
      cooldown: 3,
      args: true,
      player: {
        voice: false,
        dj: false,
        active: false,
        djPerm: null,
      },
      permissions: {
        dev: false,
        client: ["SendMessages", "ViewChannel", "EmbedLinks"],
        user: [],
      },
      slashCommand: true,
      options: [
        {
          name: "add",
          description: "Add a song to a playlist",
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "playlist",
              description: "The name of the playlist",
              type: ApplicationCommandOptionType.String,
              required: true,
            },
            {
              name: "song",
              description: "The song you want to add",
              type: ApplicationCommandOptionType.String,
              required: true,
            },
          ],
        },
        {
          name: "create",
          description: "Create a new playlist",
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "name",
              description: "The name of the playlist",
              type: ApplicationCommandOptionType.String,
              required: true,
            },
          ],
        },
        {
          name: "delete",
          description: "Delete a playlist",
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "playlist",
              description: "The name of the playlist to delete",
              type: ApplicationCommandOptionType.String,
              required: true,
            },
          ],
        },
        {
          name: "load",
          description: "Load a playlist",
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "playlist",
              description: "The name of the playlist to load",
              type: ApplicationCommandOptionType.String,
              required: true,
            },
          ],
        },
      ],
    });
  }

  async run(client, ctx, args) {
    const subcommand = ctx.options.getSubcommand();

    switch (subcommand) {
      case "add": {
        const playlist = ctx.options.getString("playlist");
        const song = ctx.options.getString("song");

        if (!playlist)
          return await ctx.sendMessage({
            embeds: [{ description: "Please provide a playlist", color: client.color.red }],
          });

        if (!song)
          return await ctx.sendMessage({
            embeds: [{ description: "Please provide a song", color: client.color.red }],
          });

        const playlistData = await client.db.getPLaylist(ctx.author.id, playlist);
        if (!playlistData)
          return await ctx.sendMessage({
            embeds: [{ description: "That playlist doesn't exist", color: client.color.red }],
          });

        const res = await client.queue.search(song);
        if (!res)
          return await ctx.sendMessage({
            embeds: [{ description: "No songs found", color: client.color.red }],
          });

        let trackStrings, count;
        if (res.loadType === LoadType.PLAYLIST) {
          trackStrings = res.data.tracks.map((track) => track);
          count = res.data.tracks.length;
        } else {
          trackStrings = [res.data[0]];
          count = 1;
        }

        await client.db.addSong(ctx.author.id, playlist, trackStrings);
        return await ctx.sendMessage({
          embeds: [{ description: `Added ${count} to ${playlistData.name}`, color: client.color.green }],
        });
      }

      case "create": {
        const name = ctx.options.getString("name").replace(/\s/g, "");

        if (name.length > 50)
          return await ctx.sendMessage({
            embeds: [{ description: "Playlist names can only be 50 characters long", color: client.color.red }],
          });

        const playlist = await client.db.getPLaylist(ctx.author.id, name);
        if (playlist)
          return await ctx.sendMessage({
            embeds: [{ description: "A playlist with that name already exists", color: client.color.main }],
          });

        await client.db.createPlaylist(ctx.author.id, name);
        return await ctx.sendMessage({
          embeds: [{ description: `Playlist **${name}** has been created`, color: client.color.main }],
        });
      }

      case "delete": {
        const playlist = ctx.options.getString("playlist").replace(/\s/g, "");

        const playlistExists = await client.db.getPLaylist(ctx.author.id, playlist);
        if (!playlistExists)
          return await ctx.sendMessage({
            embeds: [{ description: "That playlist doesn't exist", color: client.color.red }],
          });

        await client.db.deletePlaylist(ctx.author.id, playlist);
        return await ctx.sendMessage({
          embeds: [{ description: `Deleted playlist **${playlist}**`, color: client.color.main }],
        });
      }

      case "load": {
        const playlist = ctx.options.getString("playlist").replace(/\s/g, "");
        const playlistData = await client.db.getPLaylist(ctx.author.id, playlist);

        if (!playlistData)
          return await ctx.sendMessage({
            embeds: [{ description: "That playlist doesn't exist", color: client.color.red }],
          });

        let player = client.queue.get(ctx.guild.id);
        const vc = ctx.member;
        for await (const song of JSON.parse(playlistData.songs).map((s) => s)) {
          if (!player)
            player = await client.queue.create(
              ctx.guild,
              vc.voice.channel,
              ctx.channel,
              client.shoukaku.options.nodeResolver(client.shoukaku.nodes)
            );

          const track = player.buildTrack(song, ctx.author);
          player.queue.push(track);
          player.isPlaying();
        }

        return await ctx.sendMessage({
          embeds: [
            { description: `Loaded \`${playlistData.name}\` with \`${JSON.parse(playlistData.songs).length}\` songs`, color: client.color.main },
          ],
        });
      }
    }
  }
};
