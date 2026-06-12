import type { ChatInputCommandInteraction, SlashCommandOptionsOnlyBuilder } from "discord.js";

export interface CommandInterface {
	data: SlashCommandOptionsOnlyBuilder,
	execute(interaction: ChatInputCommandInteraction): Promise<void>
}