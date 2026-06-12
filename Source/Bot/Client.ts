import { ChatInputCommandInteraction, Events, MessageFlags, REST, Routes } from "discord.js";
import { Bot } from "./Bot";
import { Env } from "../Env";
import CheckCommand from "./Commands/Check";

const client = new Bot({
	intents: [],
});

async function respondToChatInteraction(interaction: ChatInputCommandInteraction) {
	const command = client.commands.get(interaction.commandName);

	if (!command) throw new Error(`Unknown command ${interaction.commandName}`);

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({
				content: "An error occurred while executing this command.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		await interaction.reply({
			content: "An error occurred while executing this command.",
			flags: MessageFlags.Ephemeral,
		});
	}
}

client.on(Events.InteractionCreate, (interaction) => {
	if (interaction.isChatInputCommand()) {
		respondToChatInteraction(interaction).catch(console.log);
	}
});

const TOKEN = Env.BOT_TOKEN;

client.once(Events.ClientReady, (readyClient) => {
	console.log(`Logged in as ${readyClient.user.tag}`);

	if (!client.token) throw new Error("No token provided");
	if (!client.application) throw new Error("No application provided");

	const rest = new REST().setToken(client.token);

	client.commands.set(CheckCommand.data.name, CheckCommand);

	const commands = client.commands.map((command) => command.data);
	rest.put(Routes.applicationCommands(client.application.id), {
		body: commands,
	}).catch(console.log);
});

void client.login(TOKEN);

export default client;