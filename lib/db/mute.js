const config = require('../../config');
const { DataTypes } = require('sequelize');

const muteModel = config.DATABASE.define('mute', {
    chat: {
        type: DataTypes.STRING,
        allowNull: false
    },
    context: {
        type: DataTypes.TEXT,
        allowNull: false
    }
});

exports.setMute = async (chat, action, enabled, hour, minute, msg) => {
    const whereClause = { chat: chat };
    const findOptions = { where: whereClause };
    const existingMutes = await muteModel.findAll(findOptions);

    if (existingMutes.length < 1) {
        if (!hour) {
            return false;
        }
        const defaultData = {
            hour: '',
            minute: '',
            enabled: false,
            msg: ''
        };
        const newData = {
            mute: { ...defaultData },
            unmute: { ...defaultData }
        };
        newData[action].hour = hour;
        newData[action].minute = minute;
        newData[action].enabled = enabled ?? false;
        newData[action].msg = msg ?? 'null';
        return await muteModel.create({
            chat: chat,
            context: JSON.stringify(newData)
        });
    } else {
        const parsedData = JSON.parse(existingMutes[0].context);
        parsedData[action].hour = hour ?? parsedData[action].hour;
        parsedData[action].minute = minute ?? parsedData[action].minute;
        parsedData[action].enabled = enabled ?? parsedData[action].enabled;
        parsedData[action].msg = msg ?? parsedData[action].msg ?? 'null';
        await existingMutes[0].update({
            chat: chat,
            context: JSON.stringify(parsedData)
        });
        return true;
    }
};

exports.getMute = async (chat, action) => {
    const whereClause = { chat: chat };
    const findOptions = { where: whereClause };
    const result = await muteModel.findAll(findOptions);

    if (result.length < 1) {
        return false;
    }
    return JSON.parse(result[0].context)[action];
};

exports.getAllMute = async () => await muteModel.findAll();

const scheduleModel = config.DATABASE.define('schedule', {
    chat: {
        type: DataTypes.STRING,
        allowNull: false
    },
    time: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    msg: {
        type: DataTypes.TEXT,
        allowNull: false
    }
});

exports.setScheduleMessage = async (chat, time, message) => {
    chat = chat.trim();
    time = time.toLowerCase();
    try {
        const replyMessage = message.reply_message?.message?.message;
        let messageType = Object.keys(replyMessage)[0];
        if (messageType === 'conversation') {
            replyMessage['extendedTextMessage'] = { text: replyMessage[messageType] };
            delete replyMessage['conversation'];
            messageType = 'extendedTextMessage';
        }
        if (messageType === 'conversation') {
            replyMessage['extendedTextMessage'] = { text: replyMessage[messageType] };
            delete replyMessage.conversation;
            messageType = 'endedTextMessage';
        } else {
            replyMessage[messageType].contextInfo = {};
        }
        await scheduleModel.create({
            chat: chat,
            time: time,
            msg: JSON.stringify(replyMessage)
        });
        return replyMessage;
    } catch (error) {
        // Handle error
    }
};

exports.getScheduleMessage = async (chat, all) => {
    if (chat) {
        const whereClause = { chat: chat };
        const findOptions = { where: whereClause };
        const result = await scheduleModel.findAll(findOptions);
        return result[0];
    }
    const findAllOptions = { where: {} };
    const result = await scheduleModel.findAll(findAllOptions);
    if (all) {
        return result;
    }
    return result.map(item => ({
        jid: item.chat,
        time: item.time.match(/(\*\/\d{1,2}|\d{1,2}-\d{1,2}|\d{1,2})/g)?.join('-')
    }));
};

exports.delScheduleMessage = async (chat, time) => {
    chat = chat.trim();
    time = time.toLowerCase();
    const whereClause = { chat: chat };
    whereClause.time = time;
    const deleteOptions = { where: whereClause };
    const result = await scheduleModel.findAll(deleteOptions);
    if (result.length < 1) {
        return false;
    }
    await result[0].destroy();
    return true;
};
