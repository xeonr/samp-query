var dgram = require('dgram')

var query = function (options) {
    var self = this;

    return new Promise((resolve, reject) => {
        if (typeof options === 'string') {
            options.host = options;
        }

        options.port = options.port || 7777
        options.timeout = options.timeout || 1000

        if (!options.host) {
            return reject(new Error('Missing host'));
        }

        if (!isFinite(options.port) || options.port < 1 || options.port > 65535) {
            return reject(new Error('Invalid port'));
        }

        var response = {}

        request.call(self, options, 'i', function (error, information) {
            if (error) {
                return reject(error instanceof Error ? error : new Error(error));
            }

            response.address = options.host
            response.port = options.port
            response.hostname = information.hostname
            response.gamemode = information.gamemode
            response.language = information.language
            response.passworded = information.passworded === 1
            response.maxplayers = information.maxplayers
            response.online = information.players
            response.ping = information.ping

            request.call(self, options, 'r', function (error, rules) {
                if (error) {
                    return reject(error instanceof Error ? error : new Error(error));
                }

                delete rules.ping;

                if (typeof rules.weather !== "undefined") {
                    if (!isNaN(rules.weather)) {
                        rules.weather = parseInt(rules.weather, 10);
                    }
                }

                response.rules = rules

                if (response.online > 100) {
                    response.players = []

                    return resolve(response);
                }
                else {
                    request.call(self, options, 'd', function (error, players) {
                        if (error) {
                            return reject(error instanceof Error ? error : new Error(error));
                        }

                        response.players = players

                        return resolve(response);
                    })
                }
            })
        })
    });
}

var request = function (options, opcode, callback) {

    var socket = dgram.createSocket("udp4")
    var packet = Buffer.alloc(10 + opcode.length)

    packet.write('SAMP')

    for (var i = 0; i < 4; ++i)
        packet[i + 4] = options.host.split('.')[i]

    packet[8] = options.port & 0xFF
    packet[9] = options.port >> 8 & 0xFF
    packet[10] = opcode.charCodeAt(0)

    let ping_start;
    try {
        socket.send(packet, 0, packet.length, options.port, options.host, function (error, bytes) {
            if (error) return callback.apply(options, [error])
            ping_start = Date.now();
        })
    } catch (error) {
        return callback.apply(options, [error])
    }

    var controller = undefined

    var onTimeOut = function () {
        socket.close()
        return callback.apply(options, ['Host unavailable'])
    }

    controller = setTimeout(onTimeOut, options.timeout)

    socket.on('message', function (message) {
        let ping = Date.now() - ping_start;

        if (controller)
            clearTimeout(controller)

        if (message.length < 11) return callback.apply(options, [true])
        else {
            socket.close()

            message = message.slice(11)

            var object = { ping }
            var array = []
            var strlen = 0
            var offset = 0

            try {

                if (opcode == 'i') {

                    object.passworded = message.readUInt8(offset)
                    offset += 1

                    object.players = message.readUInt16LE(offset)
                    offset += 2

                    object.maxplayers = message.readUInt16LE(offset)
                    offset += 2

                    strlen = message.readUInt16LE(offset)
                    offset += 4

                    object.hostname = decode(message.slice(offset, offset += strlen))

                    strlen = message.readUInt16LE(offset)
                    offset += 4

                    object.gamemode = decode(message.slice(offset, offset += strlen))

                    strlen = message.readUInt16LE(offset)
                    offset += 4

                    object.language = decode(message.slice(offset, offset += strlen))

                    return callback.apply(options, [false, object])

                }

                if (opcode == 'r') {

                    var rulecount = message.readUInt16LE(offset)
                    offset += 2

                    var property, value = undefined

                    while (rulecount) {

                        strlen = message.readUInt8(offset)
                        ++offset

                        property = decode(message.slice(offset, offset += strlen))

                        strlen = message.readUInt8(offset)
                        ++offset

                        value = decode(message.slice(offset, offset += strlen))

                        object[property] = value

                        --rulecount
                    }

                    return callback.apply(options, [false, object])
                }

                if (opcode == 'd') {

                    var playercount = message.readUInt16LE(offset)
                    offset += 2

                    var player = undefined;

                    while (playercount) {

                        player = {}

                        player.id = message.readUInt8(offset)
                        ++offset

                        strlen = message.readUInt8(offset)
                        ++offset

                        player.name = decode(message.slice(offset, offset += strlen))

                        player.score = message.readUInt16LE(offset)
                        offset += 4

                        player.ping = message.readUInt16LE(offset)
                        offset += 4

                        array.push(player)

                        --playercount
                    }

                    return callback.apply(options, [false, array])
                }

            } catch (exception) {
                return callback.apply(options, [exception])
            }
        }
    })
}

const iconv = require('iconv-lite');
var decode = function (buffer) {
    return iconv.decode(buffer, 'win1251');
}

module.exports = query
