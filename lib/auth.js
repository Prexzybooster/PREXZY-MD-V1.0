const extractUrl = (input = 'null') => {
    const matches = input.match(/(http|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/g);
    return matches ? matches[0] : false;
};

const {
    BufferJSON,
    initAuthCreds,
    WAProto
} = require('baileys');
const {
    getBuffer,
    getJson
} = require('./fetch');
const {
    setKeys,
    getCreds,
    setCreds,
    restoreKeys
} = require('./db/index');
const config = require('../config');
const { stopInstance } = require('./pm2.js');
const {
    delKeys,
    getKeys
} = require('./db/session');

const keyMappings = {
    'pre-key': 'preKeys',
    session: 'sessions',
    'sender-key': 'senderKeys',
    'app-state-sync-key': 'appStateSyncKeys',
    'app-state-sync-version': 'appStateVersions',
    'sender-key-memory': 'senderKeyMemory'
};

const initAuthSys = async (sessionId, logger) => {
    let credentials;
    let isNewSession = false;
    const savedCreds = await getCreds();
    
    if (!savedCreds) {
        logger.info('Initiating New AuthState.');
    }

    if (!savedCreds && !config.SESSION_ID && config.VPS) {
        logger.info('Generating Qr...');
        credentials = initAuthCreds();
    } else if (!savedCreds && config.SESSION_ID) {
        logger.info('Loading auth file');
        try {
            const bufferResult = await getBuffer(sessionId, false);
            if (bufferResult.buffer) {
                const parsedCreds = JSON.parse(bufferResult.buffer.toString(), BufferJSON.reviver);
                credentials = parsedCreds.auth.creds;
                for (const type in parsedCreds.auth.keys) {
                    for (const key in parsedCreds.auth.keys[type]) {
                        await setKeys(type, key, parsedCreds.auth.keys[type][key]);
                    }
                }
                await setCreds(credentials);
                logger.info('Session restored');
            } else {
                logger.error('Invalid session ID, scan again!');
                return { state: false };
            }
        } catch (error) {
            logger.error('Error restoring session:', error);
        }
    } else if (savedCreds) {
        credentials = savedCreds;
    } else {
        return false;
    }

    return {
        state: {
            creds: credentials,
            keys: {
                get: async (type, ids) => {
                    const mappedType = keyMappings[type] || type;
                    const results = {};
                    await Promise.all(ids.map(async id => {
                        const key = await getKeys(mappedType, id);
                        if (type === 'app-state-sync-key' && key) {
                            results[id] = WAProto.Message.AppStateSyncKeyData.fromObject(key);
                        } else {
                            results[id] = key;
                        }
                    }));
                    return results;
                },
                set: async (data) => {
                    const promises = [];
                    for (const type in data) {
                        const mappedType = keyMappings[type] || type;
                        for (const id in data[type]) {
                            const key = data[type][id];
                            promises.push(key ? setKeys(mappedType, id, key) : delKeys(mappedType, id));
                        }
                    }
                    await Promise.all(promises);
                }
            }
        },
        saveState: async () => await setCreds(credentials),
        isNew: isNewSession
    };
};
exports.initAuthSys = initAuthSys;