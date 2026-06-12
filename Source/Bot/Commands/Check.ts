import { AttachmentBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import identifyDiscordAccountsFromFriendList from "../../Detection/Detection";
import type { CommandInterface } from "../Types/CommandInterface";

const CheckCommand: CommandInterface = {
	data: new SlashCommandBuilder()
		.setName("check")
		.setDescription("Checks a Roblox profile and available friends for flagged discord accounts. May take a long time.")

		.addIntegerOption(option => option
			.setName("roblox_user_id")
			.setDescription("The Roblox profile to check.")
			.setMinValue(1)
			.setRequired(true))

		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

	async execute(interaction) {
		const response = interaction.deferReply({
			flags: MessageFlags.Ephemeral,
		}).catch(console.log);

		const robloxId = interaction.options.getInteger("roblox_user_id") ?? 0;

		const accounts = await identifyDiscordAccountsFromFriendList(robloxId).catch(async reason => {
			if (reason instanceof Error) {
				await response;
				interaction.editReply("An error occured: " + reason.message).catch(console.log);
			} else console.log(reason);
		});

		if (!accounts) return;

		await response;

		if (accounts.length < 1) {
			await interaction.editReply("No flagged accounts found!");
			return;
		}

		let output = "Results:";
		for (const account of accounts) {
			output += `\n?ban ${account.id} Inside ${account.serverCount} Condo Servers, Roblox IDs: ${account.robloxAccounts.join(", ")}`;
		}

		const file = new AttachmentBuilder(Buffer.from(output)).setName("Results.txt");

		await interaction.editReply({
			content: "Found flagged accounts:",
			files: [file],
		});
	},
};

export default CheckCommand;