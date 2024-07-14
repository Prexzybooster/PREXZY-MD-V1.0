const { DataTypes } = require('sequelize');
const config = require('../../config');

const mentionModel = config.DATABASE.define('men', {
    enabled: DataTypes.BOOLEAN,
    text: DataTypes.TEXT
});

const getMention = async () => {
    const result = await mentionModel.findAll({ where: {} });
    if (result.length < 1) {
        return false;
    } else {
        return result[0]['dataValues'].text;
    }
};

exports.getMention = getMention;
exports.mentionMessage = async () => (await getMention())?.text;

exports.enableMention = async (isEnabled, message) => {
    if (typeof isEnabled === 'string') {
        const defaultMention = await mentionModel.findAll();
        isEnabled = defaultMention?.enabled || true;
    }

    try {
        const result = await mentionModel.findAll({});
        if (result.length < 1) {
            const mentionData = {
                enabled: isEnabled,
                text: message || 'Hi'
            };
            return await mentionModel.create(mentionData);
        } else {
            return await result[0].update({
                'enabled': isEnabled,
                'text': message || result[0].dataValues.text
            });
        }
    } catch (error) {
        // Handle error
    }
};

const personalMessageModel = config.DATABASE.define('personalMessage', {
    uid: {
        type: DataTypes.STRING,
        allowNull: false
    }
});

const hasPersonalMessage = async (uid) => {
    const result = await personalMessageModel.findAll({ where: { uid: uid } });
    return result.length > 0;
};

const setPersonalMessage = async (uid) => {
    const whereCondition = { uid: uid };
    const result = await personalMessageModel.findAll({ where: whereCondition });
    const insertData = { uid: uid };

    if (result.length < 1) {
        await personalMessageModel.create(insertData);
    }
};

exports.getPmMessage = hasPersonalMessage;
exports.setPmMessage = setPersonalMessage;
