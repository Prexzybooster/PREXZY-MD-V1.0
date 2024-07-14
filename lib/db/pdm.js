const { DataTypes, Sequelize } = require('sequelize');
const path = require('path');
const config = require('../../config');

const pdmModel = config.DATABASE.define('pdm', {
    chat: {
        type: DataTypes.STRING,
        allowNull: false
    },
    enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    }
});

const messageDB = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../messages.db'),
    logging: false
});

const messageModel = messageDB.define('message', {
    mid: {
        type: DataTypes.STRING,
        allowNull: false
    },
    m: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    delete: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
});

exports.getPdm = async function (chat) {
    const result = await pdmModel.findAll({ where: { chat: chat } });
    return result.length < 1 ? false : result[0].dataValues?.enabled;
};

exports.setPdm = async function (chat, enabled) {
    const result = await pdmModel.findAll({ where: { chat: chat } });
    
    if (result.length < 1) {
        const newEntry = { chat: chat, enabled: enabled === 'on' };
        return await pdmModel.create(newEntry);
    } else {
        return await result[0].update({ enabled: enabled === 'on' });
    }
};

exports.setTMessage = async function (mid, message, deleteFlag) {
    const messageJSON = JSON.stringify(message);
    const whereClause = { mid: mid };
    const findOptions = { where: whereClause };
    const existingMessage = await messageModel.findAll(findOptions);
    
    const messageData = { mid: mid, m: messageJSON };
    
    if (existingMessage.length < 1 && !deleteFlag) {
        return await messageModel.create(messageData);
    }
    
    if (existingMessage[0]) {
        await existingMessage[0].destroy();
    }
};

exports.getTMessage = async function (mid) {
    const whereClause = { mid: mid };
    const findOptions = { where: whereClause };
    const result = await messageModel.findAll(findOptions);
    
    if (result.length < 1 || result[0].delete) {
        return false;
    }
    
    return JSON.parse(result[0].m);
};

exports.getDeletedMessage = async function () {
    const whereClause = { delete: true };
    const findOptions = { where: whereClause };
    const result = await messageModel.findAll(findOptions);
    
    if (result.length < 1) {
        return [];
    }
    
    return result.map(entry => JSON.parse(entry.m));
};

exports.MessageDB = messageDB;
