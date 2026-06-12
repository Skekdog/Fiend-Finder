import { sleep } from "bun";

const ROTECTOR_BASE_URL = "https://roscoe.rotector.com";
const ROBLOX_FRIENDS_BASE_URL = "https://friends.roblox.com";

const SLEEP_DURATION_MS = 500;
// I couldn't find documentation on the rate limits, but 500ms seemed to work fine.
// Any lower than 500ms would cause rate limits to be tripped on large friends lists.
// n.b. I'm not actually aware of any docs existing, not just on the rate limits.

// The flag types that the API returns. Description is taken verbatim from the browser extension.
// -1: "Unknown",
// 0: "Unflagged", // "No violations detected. Return this for users not yet analyzed or unknown to your system."
// 1: "Flagged", // "System-detected violations with high accuracy."
// 2: "Confirmed", // "Violations manually verified by a human moderator. Primary type for inappropriate users."
// 3: "Queued", // "Submitted for review. Not yet confirmed as inappropriate."
// 4: "Provisional Flag", // "Flagged by the system but reasons are withheld pending human review of the violation."
// 5: "Mixed", // "Some inappropriate activity observed but evidence is inconclusive."
// 6: "Past Offender", // "Previously flagged but has since cleared violations."
// 8: "Redacted", // "Confirmed flagged user whose specific reasons and evidence are not shown in compliance with applicable privacy laws."

const BANNED_FLAGS = [1, 2, 8];

type Friends = {
	data: [{
		id: number,
		name: string,
		displayName: string,
	}],
	errors: undefined,
} | {
	errors: [{
		code: number,
		message: string,
		userFacingMessage: string,
	}],
	data: undefined,
};

type RotectorErrorResponse = {
	success: false,
	error: string,
	requestId: string,
	type: string,
	code: string,
};

type Check = {
	success: true,
	data: {
		id: number,
		flagType: 0 | -1,
	} | {
		id: number,
		flagType: 1 | 2 | 3 | 4 | 5 | 6 | 8,
		category: number,
		confidence: number,
		reasons: {
			[reason: string]: {
				x: unknown,
			},
		},
		reviewer: {
			username: string,
			displayName: string,
		},
		engineVersion: string,
		versionCompatibility: string,
		isReportable: boolean,
		lastUpdated: number,
	},
} | RotectorErrorResponse;

type DiscordLookup = {
	success: true,
	data: {
		robloxUserId: number,
		discordAccounts: [{
			id: string,
			detectedAt: number,
			updatedAt: number,
			servers: [
				{
					serverId: string,
					serverName: string,
					joinedAt: null,
					updatedAt: number,
					firstSeenAt: number,
					isTase: boolean,
					inGracePeriod: boolean,
				},
			],
			sources: [number],
		}],
		altAccounts: [{
			robloxUserId: number,
			robloxUsername: string,
			detectedAt: number,
			updatedAt: number,
			sources: [],
		}],
	},
} | RotectorErrorResponse;

type IdentifiedAccountDetails = {
	id: string,
	serverCount: number,
	robloxAccounts: number[],
};

async function identifyDiscordAccounts(robloxUser: number): Promise<IdentifiedAccountDetails[]> {
	const flagResponse = await (await fetch(ROTECTOR_BASE_URL + `/v1/lookup/roblox/user/${robloxUser}`)).json() as Check;
	if (!flagResponse.success) throw new Error(flagResponse.error);

	if (!(flagResponse.data.flagType in BANNED_FLAGS)) return [];

	const response = await (await fetch(ROTECTOR_BASE_URL + `/v1/lookup/roblox/user/${robloxUser}/discord`)).json() as DiscordLookup;

	if (!response.success) throw new Error(response.error);

	const robloxAccounts: number[] = [robloxUser];
	for (const account of response.data.altAccounts) {
		robloxAccounts.push(account.robloxUserId);
	}

	const accounts: IdentifiedAccountDetails[] = [];
	for (const account of response.data.discordAccounts) {
		accounts.push({
			id: account.id,
			serverCount: account.servers.length,
			robloxAccounts: robloxAccounts,
		});
	}

	return accounts;
}

export default async function identifyDiscordAccountsFromFriendList(robloxUser: number): Promise<IdentifiedAccountDetails[]> {
	const response = await ((await fetch(ROBLOX_FRIENDS_BASE_URL + `/v1/users/${robloxUser}/friends`)).json()) as Friends;
	if (response.errors) {
		if (response.errors[0].code === 1) throw new Error("Could not fetch user friends list. This may be due to privacy restrictions, or an invalid user id.");
		throw new Error(response.errors[0].message);
	}

	const promises: Promise<unknown>[] = [];
	const accounts: IdentifiedAccountDetails[] = [];

	promises.push(identifyDiscordAccounts(robloxUser)
		.then(newAccounts => {
			for (const account of newAccounts) {
				accounts.push(account);
			}
		})
		.catch((reason: Error) => console.log(reason.message, robloxUser))
	);

	for (const friend of response.data) {
		if (friend.id === -1) continue;

		await sleep(SLEEP_DURATION_MS);

		promises.push(identifyDiscordAccounts(friend.id)
			.then(newAccounts => {
				for (const account of newAccounts) {
					accounts.push(account);
				}
			})
			.catch((reason: Error) => console.log(reason.message, friend.id))
		);
	}

	await Promise.allSettled(promises);

	return accounts;
}