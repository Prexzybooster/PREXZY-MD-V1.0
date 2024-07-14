const config = require('../../config');
const { DataTypes } = require('sequelize');

const chatSchema = {
    chat: {
        type: DataTypes.STRING,
        allowNull: false
    },
    enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    },
    code: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '^(1|9944|64|62|7|44|92|48|52|36|60|65|972|33|56|49|38|51)'
    }
};

const Fake = config.DATABASE.define('fake', chatSchema);

exports.getFake = async function(chat) {
    const criteria = { chat };
    const options = { where: criteria };
    const result = await Fake.findAll(options);

    if (result.length < 1) {
        return false;
    } else {
        return result[0].dataValues;
    }
};

exports.setFake = async function(chat, enabled, code) {
    try {
        const criteria = { chat };
        const options = { where: criteria };
        const result = await Fake.findAll(options);

        if (result.length < 1) {
            const newEntry = { chat, enabled, code };
            return await Fake.create(newEntry);
        } else {
            return await result[0].update({
                chat,
                enabled,
                code: code || result[0].dataValues.code
            });
        }
    } catch (error) {
        console.error(error);
    }
};
