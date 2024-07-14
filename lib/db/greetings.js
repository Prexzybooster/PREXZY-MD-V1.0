const config = require('../../config');
const { DataTypes } = require('sequelize');

const chatDefinition = {
    type: DataTypes.STRING,
    allowNull: false,
};

const typeDefinition = {
    type: DataTypes.STRING,
    defaultValue: 'welcome',
};

const messageDefinition = {
    type: DataTypes.TEXT,
    allowNull: false,
};

const enabledDefinition = {
    type: DataTypes.BOOLEAN,
    allowNull: false,
};

const greetingDefinition = {
    chat: chatDefinition,
    type: typeDefinition,
    message: messageDefinition,
    enabled: enabledDefinition,
};

const GreetingModel = config.DATABASE.define('Greeting', greetingDefinition);

exports.getMessage = async function (chat, type) {
    const condition = {
        chat: chat,
        type: type,
    };

    const queryOptions = { where: condition };
    const results = await GreetingModel.findAll(queryOptions);

    if (results.length < 1) {
        return false;
    }

    return results[0].dataValues;
};

exports.setMessage = async function (chat, type, message, enabled = true) {
    try {
        const condition = {
            chat: chat,
            type: type,
        };

        const queryOptions = { where: condition };
        const existingMessages = await GreetingModel.findAll(queryOptions);

        if (existingMessages.length < 1) {
            const newMessage = {
                chat: chat,
                type: type,
                message: message,
                enabled: enabled,
            };

            return await GreetingModel.create(newMessage);
        } else {
            const updatedMessage = {
                chat: chat,
                type: type,
                message: message,
                enabled: enabled,
            };

            return await existingMessages[0].update(updatedMessage);
        }
    } catch (error) {
        // Handle error if needed
    }
};

exports.deleteMessage = async function (chat, type) {
    const condition = {
        chat: chat,
        type: type,
    };

    const queryOptions = { where: condition };
    const messagesToDelete = await GreetingModel.findAll(queryOptions);

    return await messagesToDelete[0].destroy();
};
