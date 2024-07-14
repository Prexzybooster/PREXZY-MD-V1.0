const { DataTypes } = require('sequelize');
const config = require('../../config');

const Wort = config.DATABASE.define('Wort', {
    wort: {
        type: DataTypes.STRING,
        allowNull: false
    }
});

exports.setWort = async function (wort) {
    const foundWort = await Wort.findAll({ where: { wort } });
    if (foundWort.length) return;
    await Wort.create({ wort });
};

exports.delWort = async function (wort) {
    const foundWort = await Wort.findAll({ where: { wort } });
    if (!foundWort.length) return;
    await foundWort[0].destroy();
};

exports.getWorts = async function () {
    const worts = await Wort.findAll({ where: {} });
    return worts.map(item => item.wort);
};

const Afk = config.DATABASE.define('afk', {
    uid: {
        type: DataTypes.STRING,
        allowNull: false
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: false
    }
});

exports.setAfk = async function (uid, reason) {
    let afkEntry = await Afk.findAll({ where: { uid } });
    if (afkEntry.length) {
        return afkEntry[0].update({ uid, reason });
    }
    return await Afk.create({ uid, reason });
};

exports.getAfk = async function () {
    return await Afk.findAll({ where: {} });
};

exports.delAfk = async function (uid) {
    let afkEntry = await Afk.findAll({ where: { uid } });
    if (!afkEntry.length) return;
    await afkEntry[0].destroy();
};

const Zahlen = config.DATABASE.define('zahlen', {
    gid: {
        type: DataTypes.STRING,
        allowNull: false
    },
    uid: {
        type: DataTypes.STRING,
        allowNull: false
    },
    wort: {
        type: DataTypes.STRING,
        allowNull: false
    },
    count: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
});

exports.setWortCount = async function (gid, uid, wort) {
    let foundZahl = await Zahlen.findAll({ where: { gid, uid, wort } });
    if (foundZahl.length) {
        return foundZahl[0].update({ gid, uid, wort, count: foundZahl[0].count + 1 });
    }
    return await Zahlen.create({ gid, uid, wort, count: 1 });
};

exports.getWortCount = async function (wort, gid, uid) {
    if (!wort) {
        let worts = await exports.getWorts();
        let result = {};
        for (let w of worts) {
            let counts = await exports.getWortCount(w, gid, uid);
            for (let c of counts) {
                let word = c.wort;
                if (!result[word]) {
                    result[word] = {};
                }
                if (!result[word][c.gid]) {
                    result[word][c.gid] = {};
                }
                result[word][c.gid][c.uid] = c.count;
            }
        }
        return result;
    }
    let query = { wort };
    if (gid) query.gid = gid;
    if (uid) query.uid = uid;
    return await Zahlen.findAll({ where: query });
};

exports.delWortCount = async function (gid, uid, wort) {
    let query = { uid, wort };
    if (gid) query.gid = gid;
    let foundZahlen = await Zahlen.findAll({ where: query });
    if (!foundZahlen.length) return;
    for (let z of foundZahlen) {
        await z.destroy();
    }
};
