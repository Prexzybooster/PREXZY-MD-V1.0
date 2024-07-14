const config = require('../../config');
const { DataTypes } = require('sequelize');

const filterSchema = {
    chat: {
        type: DataTypes.STRING,
        allowNull: false
    },
    pattern: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    text: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    regex: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    }
};

const Filter = config.DATABASE.define('filter', filterSchema);

const filterCache = {};

exports.setFilter = async (chat, pattern, text, regex) => {
    delete filterCache[chat];

    const criteria = { chat, pattern };
    const options = { where: criteria };
    const existingFilter = await Filter.findAll(options);

    if (existingFilter.length < 1) {
        const newFilter = { chat, pattern, text, regex };
        return await Filter.create(newFilter);
    } else {
        const updateData = { chat, pattern, text, regex };
        return await existingFilter[0].update(updateData);
    }
};

exports.getFilter = async (chat) => {
    if (chat in filterCache) {
        return filterCache[chat];
    }

    const criteria = { chat };
    const options = { where: criteria };
    const filters = await Filter.findAll(options);

    if (filters.length < 1) {
        filterCache[chat] = false;
        return false;
    }

    filterCache[chat] = filters;
    return filters;
};

exports.delFilter = async (chat, pattern) => {
    delete filterCache[chat];

    const criteria = { chat, pattern };
    const options = { where: criteria };
    const filterToDelete = await Filter.findAll(options);

    if (filterToDelete.length < 1) {
        return false;
    }

    return await filterToDelete[0].destroy();
};
