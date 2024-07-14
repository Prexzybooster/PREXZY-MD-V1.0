const { DataTypes } = require('sequelize');
const config = require('../../config');
const { BufferJSON } = require('baileys');

const Key = config.DATABASE.define('key', {
    type: {
        type: DataTypes.STRING
    },
    key: {
        type: DataTypes.STRING
    },
    value: {
        type: DataTypes.TEXT
    }
});

const Cred = config.DATABASE.define('cred', {
    type: {
        type: DataTypes.STRING
    },
    value: {
        type: DataTypes.TEXT
    }
});

exports.getCount = async () => {
    try {
        return await Key.count();
    } catch (error) {
        return 0;
    }
};

exports.setCreds = async (creds) => {
    const existingCreds = await Cred.findAll({ where: { type: 'creds' } });

    if (!existingCreds.length) {
        await Cred.create({
            type: 'creds',
            value: JSON.stringify(creds, BufferJSON.replacer)
        });
    } else {
        await existingCreds[0].update({
            type: 'creds',
            value: JSON.stringify(creds, BufferJSON.replacer)
        });
    }
};

exports.getCreds = async () => {
    const result = await Cred.findAll({ where: { type: 'creds' } });

    if (!result.length) {
        return;
    }
    return JSON.parse(result[0].dataValues.value, BufferJSON.reviver);
};

exports.deleteCreds = async () => await Cred.drop();

exports.getKeys = async (type, key) => {
    const result = await Key.findAll({ where: { type: type, key: key } });

    if (!result.length) {
        return null;
    }
    return JSON.parse(result[0].dataValues.value, BufferJSON.reviver);
};

exports.setKeys = async (type, key, value) => {
    const existingKey = await Key.findAll({ where: { type: type, key: key } });

    if (!existingKey.length) {
        await Key.create({
            type: type,
            key: key,
            value: JSON.stringify(value, BufferJSON.replacer)
        });
    } else {
        await existingKey[0].update({
            type: type,
            key: key,
            value: JSON.stringify(value, BufferJSON.replacer)
        });
    }
};

exports.delKeys = async (type, key) => {
    const result = await Key.findAll({ where: { type: type, key: key } });

    if (!result.length) {
        return;
    }
    await result[0].destroy();
};

exports.deleteKeys = async () => await Key.drop();

exports.restoreKeys = async () => await Key.findAll({});
