const { DataTypes } = require('sequelize');
const config = require('../../config');
const urlField = {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'false'
};
const messageField = {
    type: DataTypes.TEXT,
    allowNull: false
};
const typeField = {
    type: DataTypes.STRING,
    allowNull: false
};
const extField = {
    type: DataTypes.STRING,
    allowNull: false
};
const aliveSchema = {
    url: urlField,
    message: messageField,
    type: typeField,
    ext: extField
};
const AliveModel = config.DATABASE.define('alive', aliveSchema);

exports.getAlive = async function () {
    const options = { where: {} };
    const records = await AliveModel.findAll(options);
    if (records.length < 1) {
        return false;
    } else {
        return records[0].dataValues;
    }
};

exports.setAlive = async function (url = 'false', message = '```Hey I\'m Here``` 🥰\nuptime : #uptime\nYou can change this by .alive your message', type = 'text', ext = 'null') {
    try {
        const options = { where: {} };
        const records = await AliveModel.findAll(options);
        if (records.length < 1) {
            const newRecord = { url, message, type, ext };
            return await AliveModel.create(newRecord);
        } else {
            const updateData = { url, message, type, ext };
            return await records[0].update(updateData);
        }
    } catch (error) {
        console.error(error);
    }
};