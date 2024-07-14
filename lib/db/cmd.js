const config = require('../../config');
const { DataTypes } = require('sequelize');

const cmdSchema = {
    cmd: {
        type: DataTypes.STRING,
        allowNull: false
    }
};

const Cmd = config.DATABASE.define('cmdd', cmdSchema);

exports.getCmdState = async (cmd) => {
    const criteria = { cmd };
    const options = { where: criteria };
    const result = await Cmd.findAll(options);

    if (result.length < 1) {
        return true;
    }
    return false;
};

exports.setCmdState = async (cmd, state) => {
    const criteria = { cmd };
    const options = { where: criteria };
    const result = await Cmd.findAll(options);

    if (result.length < 1 && state === 'off') {
        const newCmd = { cmd };
        await Cmd.create(newCmd);
    } else {
        if (state !== 'off') {
            result[0]?.destroy();
        }
    }
};
