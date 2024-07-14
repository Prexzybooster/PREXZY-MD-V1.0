const { DataTypes } = require('sequelize');
const config = require('../../config');
const utils = require('../utils');

const Db = config.DATABASE.define('db', {
    db: {
        type: DataTypes.TEXT
    }
});

exports.setDb = async () => {
    const existingDb = await Db.findAll();

    if (existingDb.length < 1) {
        await Db.create({ db: JSON.stringify(db) });
    } else {
        await existingDb[0].update({ db: JSON.stringify(db) });
    }
};

exports.getDb = async () => {
    const result = await Db.findAll();

    if (result.length > 0) {
        Object.assign(db, JSON.parse(result[0].db));
    }
};

const Msg = config.DATABASE.define('msg', {
    gid: {
        type: DataTypes.STRING,
        allowNull: false
    },
    uid: {
        type: DataTypes.STRING,
        allowNull: false
    },
    data: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '{}'
    }
});

const sortMsgs = (msgs) => {
    return Object.keys(msgs)
        .sort((a, b) => msgs[b].total - msgs[a].total)
        .reduce((sorted, key) => {
            sorted[key] = msgs[key];
            return sorted;
        }, {});
};

const updateMsgData = (data, gid, type, name) => {
    const msgData = {};
    if (type) {
        const parsedData = JSON.parse(type);
        Object.assign(msgData, parsedData);
    } else {
        const newMsg = {
            name: name,
            time: new Date().toISOString(),
            total: 0,
            items: {}
        };
        Object.assign(msgData, newMsg);
    }
    msgData.updatedAt = new Date().toISOString();
    msgData.updatedAt = name;
    if (!msgData.items[type]) {
        msgData.items[type] = 0;
    }
    msgData.items[type]++;
    msgData.total++;
    Object.assign(data, msgData);
};

exports.setMsgs = async function (gid, uid, type, name) {
    const filter = { uid: uid };
    filter[gid] = gid;
    const options = { where: filter };
    const existingMsg = await Msg.findAll(options);
    const newData = {};
    updateMsgData(newData, existingMsg[0]?.data, type, name);
    if (existingMsg.length < 1) {
        await Msg.create({
            gid: gid,
            uid: uid,
            data: JSON.stringify(newData)
        });
    } else {
        await existingMsg[0].update({
            gid: gid,
            uid: uid,
            data: JSON.stringify(newData)
        });
    }
};

exports.getMsgs = async function (gid, uid) {
    if (gid && !uid) {
        const filter = { gid: gid };
        const options = { where: filter };
        const msgs = await Msg.findAll(options);
        if (msgs.length < 1) {
            return false;
        }
        const sortedMsgs = {};
        for (const msg of msgs) {
            const parsedData = JSON.parse(msg.data);
            sortedMsgs[msg.uid] = parsedData;
        }
        return sortMsgs(sortedMsgs);
    }
    const filter = { gid: gid };
    filter[uid] = uid;
    const options = { where: filter };
    const msgs = await Msg.findAll(options);
    if (msgs.length < 1) {
        return false;
    }
    return JSON.parse(msgs[0].data);
};

exports.delMsgs = async function (gid, uid) {
    const filter = {
        gid: gid,
        uid: uid
    };
    const options = { where: filter };
    const msg = await Msg.findAll(options);
    if (msg.length < 1) {
        return false;
    }
    return await msg[0].destroy();
};

exports.getName = async (gid, uid) => {
    if (!uid) {
        const group = await utils.fetchGroupMeta(gid);
        return group.subject;
    }
    const user = await exports.getMsgs(gid, uid);
    return user.name;
};

exports.resetMsgs = async (gid, uid) => {
    if (gid && !uid) {
        const filter = { gid: gid };
        const options = { where: filter };
        const msgs = await Msg.findAll(options);
        for (const msg of msgs) {
            await msg.destroy();
        }
        return 1;
    }
    const filter = {
        gid: gid,
        uid: uid
    };
    const options = { where: filter };
    const msg = await Msg.findAll(options);
    if (msg.length < 1) {
        return false;
    }
    await msg[0].destroy();
};
