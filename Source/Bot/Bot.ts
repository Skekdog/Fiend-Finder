import { Client, Collection } from "discord.js";
import type { CommandInterface } from "./Types/CommandInterface.ts";

export class Bot extends Client {
	commands: Collection<string, CommandInterface> = new Collection();
}

export function isBotClient(client: unknown): client is Bot {
	return client instanceof Bot;
}