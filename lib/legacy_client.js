const {
    default: makeWASocket,
    DisconnectReason,
    delay,
    jidNormalizedUser,
    fetchLatestBaileysVersion
} = require('@adiwajshing/baileys');
const pino = require('pino');
const { initAuthSys } = require('./auth');
const {
    deleteCreds,
    deleteKeys,
    waWebVersion,
    PREFIX,
    jidToNum,
    numToJid,
    PLUGINS
} = require('./index');
const { handleMsg } = require('./handle');
const fs = require('fs');
const path = require('path');
const {
    getPlugin,
    delPlugin,
    getDb,
    getPdm
} = require('./db');
const got = require('got');
const { join } = require('path');
const { participantUpdate } = require('./participantUpdate');
const config = require('../config');
const { commands } = require('./events');
const store = require('./store');
const { prepareMessage } = require('./sendMessage');
const { restartInstance } = require('./pm2');

exports.connect = async () => {
    const { state, saveState } = await initAuthSys();
    await state.keys.restore();

    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

    fs.readdirSync(path.join(__dirname, '../plugins')).forEach((file) => {
        if (path.extname(file).toLowerCase() === '.js') {
            try {
                require(`../plugins/${file}`);
            } catch (error) {
                console.error(error);
            }
        }
    });

    if (PLUGINS.i === 0) {
        PLUGINS.i = commands.length - 1;
    }

    try {
        const plugins = await getPlugin() || [];
        if (plugins.length) {
            console.log('Installing External plugins');
            for await (const { url, name } of plugins) {
                console.log(name);
                if (!fs.existsSync(`../plugins/${name}.js`)) {
                    try {
                        const response = await got(url);
                        if (response.statusCode === 200) {
                            try {
                                fs.writeFileSync(join(__dirname, `../plugins/${name}.js`), response.body);
                                require(join(__dirname, `../plugins/${name}.js`));
                            } catch (error) {
                                console.log(`Deleting ${name} due to error`);
                                await delPlugin(name);
                            }
                        }
                    } catch (error) {
                        console.log(`Deleting ${name} due to error`);
                        await delPlugin(name);
                    }
                }
            }
            if (PLUGINS.e === 0) {
                PLUGINS.e = commands.length - PLUGINS.i - 1;
            }
            console.log('External Plugins Installed');
        }
    } catch (error) {
        console.error(error);
    }

    const startConnection = () => {
        const logger = pino({ level: config.BAILEYS_LOG_LVL });
        const sock = makeWASocket({
            version,
            printQRInTerminal: true,
            logger,
            auth: state,
            msgRetryCounterMap: {},
            getMessage: async ({ id, remoteJid }) => {
                const chat = store.chats[remoteJid]?.find(({ key }) => key.id === id);
                return chat?.message;
            }
        });

        global.store = store.bind(sock);

        sock.ev.on('messages.upsert', async ({ type, messages }) => {
            const msg = messages[1] || messages[0];
            if (type === 'notify' && msg) {
                return handleMsg(msg, sock);
            }
        });

        sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
            if (connection === 'open') {
                PLUGINS.count = PLUGINS.i + PLUGINS.e;
                console.log('connected');
                sock.sendMessage(sock.user.id, { text: 'started' });
                sock.user.jid = jidNormalizedUser(sock.user.id);
            }

            const shouldRestart = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (connection === 'close' && shouldRestart) {
                startConnection();
            } else if (!shouldRestart) {
                console.log('Connection closed. You are logged out.');
                deleteCreds();
                deleteKeys();
                delay(3000).then(() => restartInstance());
            }
        });

        sock.ev.on('creds.update', saveState);
        sock.ev.on('group-participants.update', async (update) => {
            participantUpdate(update, sock);
        });

        sock.ws.on('CB:notification,type:w:gp2', async ({ content, attrs }) => {
            const groupId = attrs.from;
            const action = content[0]?.tag;

            if (['demote', 'promote'].includes(action)) {
                const groupData = await getPdm(groupId);
                if (!groupData) return;

                const { announce, participants } = await sock.groupMetadata(groupId);
                const [self] = participants.filter(p => p.id === sock.user.jid);
                if (announce && !self.admin) return;

                const participant = attrs?.participant;
                const affected = content[0]?.content[0]?.attrs?.jid;
                await prepareMessage(groupId, {
                    text: `@${jidToNum(participant)} ${action}d @${jidToNum(affected)}`,
                    mentions: [participant, affected]
                }, {}, sock);
            }
        });

        return sock;
    };

    startConnection();
};