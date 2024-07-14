const config = require('../config');
const handlers = config.HANDLERS === 'null' ? '' : config.HANDLERS;
const test = require('./test/test');
const commands = {};
const patterns = [];

const extractName = (pattern) => pattern.toString().match(/(\W*)([A-Za-z0-9_ğüşiö ç]*)/)[2].trim();

let regexPattern = !handlers.startsWith('^') && handlers !== '' ? handlers.replace('[', '').replace(']', '').replace(/\./g, '[.]') : /^[.]/;
try {
    new RegExp((regexPattern.startsWith('^') ? regexPattern : '^' + regexPattern) + '(test|test)', 'is');
} catch (error) {
    regexPattern = '^[.]';
}
config.HANDLERS = regexPattern;

exports.commands = commands;
exports.addCommand = function (command, handler) {
    const commandData = {
        fromMe: command.fromMe === undefined ? true : command.fromMe,
        onlyGroup: command.onlyGroup === undefined ? false : command.onlyGroup,
        desc: command.desc === undefined ? '' : command.desc,
        dontAddCommandList: command.dontAddCommandList === undefined ? false : command.dontAddCommandList,
        type: command.type === undefined ? 'undefined' : command.type,
        active: true,
        function: handler,
        name: command.pattern ? extractName(command.pattern) : command.type
    };
    if (command.on === undefined && command.pattern === undefined) {
        commandData.on = 'message';
        commandData.fromMe = false;
    } else if (command.on !== undefined && ['photo', 'image', 'sticker', 'message'].includes(command.on)) {
        commandData.on = command.on;
        if (command.pattern !== undefined) {
            commandData.pattern = new RegExp((command.handler === undefined || command.handler === true ? config.HANDLERS : '') + command.pattern, command.flags === undefined ? '' : command.flags);
        }
    } else {
        commandData.pattern = new RegExp((regexPattern.startsWith('^') ? regexPattern : '^' + regexPattern) + '|' + command.pattern, 'is');
    }
    patterns.push(commandData);
    if (!(commandData.name in commands)) {
        commands[commandData.name] = commandData;
    }
};