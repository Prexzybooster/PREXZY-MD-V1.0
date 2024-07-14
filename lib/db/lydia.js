const config = require('../../config');
const { DataTypes } = require('sequelize');

const lydiaDefinition = {
    type: DataTypes.STRING,
    allowNull: false,
};

const contextDefinition = {
    type: DataTypes.TEXT,
    allowNull: false,
};

const LydiaModelDefinition = {
    chat: lydiaDefinition,
    context: contextDefinition,
};

const LydiaModel = config.DATABASE.define('lydia', LydiaModelDefinition);

const tokenDefinition = {
    type: DataTypes.STRING,
    allowNull: false,
};

const numDefinition = {
    type: DataTypes.STRING,
    allowNull: false,
};

const TruecallerModelDefinition = {
    token: tokenDefinition,
    num: numDefinition,
};

const TruecallerModel = config.DATABASE.define('truecaller', TruecallerModelDefinition);

const lydiaCache = new Map();

exports.setLydia = async (chat, type, value) => {
    const key = value || chat;
    const cacheKey = `${chat}-${key}`;
    lydiaCache.delete(cacheKey);

    const condition = { chat: chat };
    const defaults = { chat: chat, context: '{}' };
    const options = { where: condition, defaults: defaults };

    const [lydiaEntry] = await LydiaModel.findOrCreate(options);
    const context = JSON.parse(lydiaEntry.context);

    if (type === false && context[key] === undefined) {
        throw new Error(`Lydia not activated on ${key}\n`);
    }

    context[key] = type;
    await lydiaEntry.update({ context: JSON.stringify(context) });
};

exports.getLydia = async (chat, type) => {
    const key = type || chat;
    const cacheKey = `${chat}-${key}`;

    if (lydiaCache.has(cacheKey)) {
        return lydiaCache.get(cacheKey);
    }

    const condition = { chat: chat };
    const options = { where: condition };

    const lydiaEntry = await LydiaModel.findOne(options);

    if (!lydiaEntry) {
        lydiaCache.set(cacheKey, false);
        return false;
    }

    const context = JSON.parse(lydiaEntry.context);
    const state = context[key] ?? false;
    lydiaCache.set(cacheKey, state);
    return state;
};

exports.setTruecaller = async (token, num) => {
    const existingEntry = await TruecallerModel.findOne();

    const data = {
        token: token,
        num: num,
    };

    if (!existingEntry) {
        await TruecallerModel.create(data);
    } else {
        await existingEntry.update(data);
    }
};

exports.getTruecaller = async (returnToken) => {
    const entry = await TruecallerModel.findOne();

    if (returnToken) {
        return entry && entry.token;
    }

    return entry && `number: ${entry.num}\ntoken: ${entry.token}`;
};

exports.delTruecaller = async () => {
    const entry = await TruecallerModel.findOne();

    if (!entry) {
        return entry;
    }

    await entry.destroy();
    return true;
};
