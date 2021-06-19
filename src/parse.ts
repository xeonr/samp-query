import * as iconv from 'iconv-lite';

function decode(buffer: Buffer): string {
    return iconv.decode(buffer, 'win1251');
}

export interface ISAMPInformation {
	passworded: boolean;
	online: number;
	maxplayers: number;
	hostname: string;
	gamemode: string;
	language: string;
}

export function parseInformation(buffer: Buffer): ISAMPInformation {
	const message = buffer.slice(11)

	const object: Partial<ISAMPInformation> = {};

	let offset: number = 0;
	let strlen: number = 0;

	object.passworded = message.readUInt8(offset) === 1;
	offset += 1;

	object.online = message.readUInt16LE(offset);
	offset += 2

	object.maxplayers = message.readUInt16LE(offset);
	offset += 2

	strlen = message.readUInt16LE(offset);
	offset += 4

	object.hostname = decode(message.slice(offset, offset += strlen));

	strlen = message.readUInt16LE(offset);
	offset += 4;

	object.gamemode = decode(message.slice(offset, offset += strlen))

	strlen = message.readUInt16LE(offset);
	offset += 4;

	object.language = decode(message.slice(offset, offset += strlen));

	return <ISAMPInformation>object;
}

export interface ISAMPRules {
	[key: string]: string;
}

export function parseRules(buffer: Buffer): ISAMPRules {
	const data: ISAMPRules = {};
	const message = buffer.slice(11);
	let offset: number = 0;
	let strlen: number = 0;
	
	let ruleCount = message.readUInt16LE(offset);
	offset += 2;

	
	while (ruleCount) {
		let property, value = undefined;

		strlen = message.readUInt8(offset);
		++offset;

		property = decode(message.slice(offset, offset += strlen));
		strlen = message.readUInt8(offset);
		++offset;

		value = decode(message.slice(offset, offset += strlen));
		data[property] = value;

		ruleCount -= 1;
	}

	return data;
}

export interface ISAMPPlayer {
	id: number;
	name: string;
	score: number;
	ping: number;
}

export function parsePlayers(buffer: Buffer): ISAMPPlayer[] {
	const message = buffer.slice(11);
	let offset: number = 0;
	let strlen: number = 0;
	
	let playerCount = message.readUInt16LE(offset)
	const players: ISAMPPlayer[] = [];
	offset += 2

	while (playerCount) {
		const player: Partial<ISAMPPlayer> = {};

		player.id = message.readUInt8(offset);
		++offset;

		strlen = message.readUInt8(offset);
		++offset;

		player.name = decode(message.slice(offset, offset += strlen));

		player.score = message.readUInt16LE(offset);
		offset += 4;

		player.ping = message.readUInt16LE(offset);
		offset += 4;


		players.push(<ISAMPPlayer>player);
		playerCount -= 1;
	}

	return players;
}