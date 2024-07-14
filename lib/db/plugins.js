const { DataTypes } = require('sequelize');
const config = require('../../config');

const Plugin = config.DATABASE.define('Plugin', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    url: {
        type: DataTypes.TEXT,
        allowNull: false
    }
});

exports.setPlugin = async function (name, url) {
    const result = await Plugin.findAll({ where: { name: name } });
    
    if (result.length >= 1) {
        await result[0].update({ name: name, url: url });
        return false;
    } else {
        await Plugin.create({ name: name, url: url });
        return true;
    }
};

exports.delPlugin = async function (name) {
    if (!name) {
        const allPlugins = await Plugin.findAll({});
        for (const plugin of allPlugins) {
            await plugin.destroy();
        }
    } else {
        const result = await Plugin.findAll({ where: { name: name } });
        if (result.length < 1) {
            return false;
        } else {
            await result[0].destroy();
            return true;
        }
    }
};

exports.getPlugin = async function (name) {
    if (name) {
        const result = await Plugin.findAll({ where: { name: name } });
        if (result.length < 1) {
            return false;
        } else {
            return result[0].dataValues;
        }
    }
    
    const allPlugins = await Plugin.findAll();
    let plugins = [];
    allPlugins.forEach(plugin => {
        plugins.push({
            name: plugin.dataValues.name,
            url: plugin.dataValues.url
        });
    });
    return plugins;
};
