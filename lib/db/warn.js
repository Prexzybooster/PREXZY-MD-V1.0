const { DataTypes } = require('sequelize');
const config = require('../../config');

const Warn = config.DATABASE.define('warn', {
    jid: {
        type: DataTypes.STRING,
        allowNull: false
    },
    chat: {
        type: DataTypes.STRING,
        allowNull: false
    },
    count: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
});

exports.getWarnCount = async (jid, chat) => {
    const whereClause = {
        jid: jid,
        chat: chat
    };
    const result = await Warn.findOne({ where: whereClause });
    return result ? result.count : false;
};

exports.setWarn = async (jid, chat, increment = 1) => {
    const whereClause = {
        jid: jid,
        chat: chat
    };
    const [warnInstance, created] = await Warn.findOrCreate({
        where: whereClause,
        defaults: { count: 0 }
    });
    if (!created) {
        increment = isNaN(increment) ? 1 : increment;
        increment = Math.max(warnInstance.count + increment, 0);
        if (config.WARNING_LIMIT - increment >= 0) {
            const updateData = { count: increment };
            await warnInstance.update(updateData);
        }
    }
    return increment;
};

exports.deleteWarn = async (jid, chat) => {
    const whereClause = {
        jid: jid,
        chat: chat
    };
    const deleteOptions = {
        where: whereClause,
        limit: 1
    };
    await Warn.destroy(deleteOptions);
};
