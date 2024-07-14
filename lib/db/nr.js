const { DataTypes } = require('sequelize');
const config = require('../../config');

const nrModel = config.DATABASE.define('nr', {
    uid: {
        type: DataTypes.STRING,
        allowNull: false
    },
    cmd: {
        type: DataTypes.TEXT,
        allowNull: false
    }
});

const wordRegex = new RegExp('\\b\\w+\\b', 'g');

const extractWords = text => text.match(wordRegex) || [];

exports.zushi = async (commandText, uid) => {
    delete exports.yami[uid];
    commandText = commandText.toLowerCase();

    const whereClause = { uid: uid };
    const findOptions = { where: whereClause };
    const existingEntry = await nrModel.findOne(findOptions);

    if (!existingEntry) {
        commandText = extractWords(commandText);
        await nrModel.create({
            uid: uid,
            cmd: commandText.join(',')
        });
        return commandText;
    }

    const commands = existingEntry.dataValues.cmd.split(',');
    const commandRegex = new RegExp('(' + commands.join('|') + ')', 'i');

    if (commands.length > 1 && commandRegex.test(commandText)) {
        return null;
    }

    commandText = existingEntry.dataValues.cmd + (',' + commandText);
    commandText = extractWords(commandText);
    await existingEntry.update({
        uid: uid,
        cmd: commandText.join(',')
    });

    return commandText;
};

const cache = {};

exports.yami = async uid => {
    if (uid in cache) {
        return cache[uid];
    }

    const whereClause = { uid: uid };
    const findOptions = { where: whereClause };
    const result = await nrModel.findOne(findOptions);

    cache[uid] = result ? extractWords(result.dataValues.cmd) : null;
    return cache[uid];
};

exports.ope = async (uid, command) => {
    delete cache[uid];
    command = command.toLowerCase();

    const whereClause = { uid: uid };
    const findOptions = { where: whereClause };
    const existingEntry = await nrModel.findOne(findOptions);

    if (!existingEntry) {
        return false;
    }

    if (command === 'all') {
        return await existingEntry.destroy();
    }

    const commands = existingEntry.dataValues.cmd.split(',');
    const commandRegex = new RegExp('(' + commands.join('|') + ')', 'i');

    if (!commandRegex.test(command)) {
        return null;
    }

    command = existingEntry.dataValues.cmd.replace(command, '');
    command = extractWords(command);
    await existingEntry.update({
        uid: uid,
        cmd: command.join(',')
    });

    return command;
};
