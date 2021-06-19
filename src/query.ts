import { createSocket } from 'dgram';
import { parseInformation, ISAMPInformation, ISAMPRules, parseRules, parsePlayers, ISAMPPlayer } from './parse';
import { resolve4 } from 'dns';
import { promisify } from 'util';

const resolve = promisify(resolve4);

export type SAMPOpcode = 'i' | 'r' | 'c' | 'd' | 'p';
export interface ISAMPRequest {
	host: string;
	port?: number;
	timeout?: number;
}

export type TSAMPRequest = ISAMPRequest | string;

export interface ISAMPInternalRequest {
	ip: string;
	port: number;
	timeout: number;
}

async function validateRequest(request: TSAMPRequest): Promise<ISAMPInternalRequest> {
	const validate: ISAMPInternalRequest = {
		ip: typeof request !== 'string' ? request.host : request,
		port: typeof request !== 'string' && request.port ? request.port : 7777,
		timeout: typeof request !== 'string' && request.timeout ? request.timeout : 1000,
	}

	try {
		const ips = await resolve(validate.ip);
		validate.ip = ips[0];
	} catch (e) {
		throw new Error('Invalid hostname');
	}

	if (!validate.ip) {
		throw new Error('Invalid hostname');
	}
	
	if (!isFinite(validate.port) || validate.port < 1 || validate.port > 65535) {
		throw new Error('Invalid port');
	}

	return validate;
}

function internalQuery(request: ISAMPInternalRequest, opcode: SAMPOpcode): Promise<[Buffer, number]> {
	const socket = createSocket('udp4');
	const packet = Buffer.alloc(11); // SAMP + opcode
	const octets = request.ip.split('.');

	// SAMP!
	packet.write('SAMP');

	// Add IP Address
	packet[4] = +octets[0];
	packet[5] = +octets[1];
	packet[6] = +octets[2];
	packet[7] = +octets[3];

	// Add port
	packet[8] = request.port & 0xFF;
	packet[9] = request.port >> 8 & 0xFF;

	// Add opcode
	packet[10] = opcode.charCodeAt(0);

	return new Promise<[Buffer, number]>((resolve, reject) => {
		const startedAt = new Date();

		// Setup a timeout for this request.
		const timer = setTimeout(() => {
			socket.close();
			reject(new Error('Request Timeout'));
		}, request.timeout);

		socket.send(packet, 0, packet.length, request.port, request.ip, (err: Error) => {
			// If an error occurred, cleanup.
			if (err) {
				clearTimeout(timer);
				reject(err);
				socket.close();
			}
		});
		
		// Handle a message being received.
		socket.on('message', (buffer: Buffer) => {
			clearTimeout(timer);
			resolve([buffer, +new Date() - +startedAt]);
			socket.close();
		});
	});
};

export interface ISAMPQuery extends ISAMPInformation {
	address: string;
	port: number,
	ping: number;
	rules: ISAMPRules;
	players: ISAMPPlayer[];
}

export async function query(request: TSAMPRequest): Promise<ISAMPQuery> {
	const req = await validateRequest(request);

	try {
		const [[infoBuffer, pingTime], [rulesBuffer], [playerBuffer]] = await Promise.all([
			internalQuery(req, 'i'),
			internalQuery(req, 'r'),
			internalQuery(req, 'd').catch<[Buffer, number]>(() => [null, 0]),
		]);
	
		const info = parseInformation(infoBuffer);
		const rules = parseRules(rulesBuffer);
		const players = playerBuffer ? parsePlayers(playerBuffer) : [];

		return {
			ping: pingTime,
			address: req.ip,
			port: req.port,
			...info,
			rules,
			players,
		}

	} catch (e) {
		throw e;
	}
}
