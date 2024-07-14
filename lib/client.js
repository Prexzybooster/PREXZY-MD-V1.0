const { default: baileys, DisconnectReason, delay, jidNormalizedUser, getBinaryNodeChildren, makeCacheableSignalKeyStore, getContentType, downloadMediaMessage, isJidBroadcast, generateWAMessageFromContent } = require('baileys');
const { Boom } = require('@hapi/boom');
const NodeCache = require('node-cache');
const url = require('url');
const auth = require('./auth');
const index = require('./index');
let isInitialized = false;
const { writeStream, chats } = require('./constant');
const pino = require('pino');
const util = require('util');
const { restartInstance, stopInstance } = require('./pm2');
const { getCmdState } = require('./db/cmd');
const { readdirSync, existsSync, writeFileSync, readFileSync, unlinkSync, mkdir, emptyDir } = require('fs-extra');
const path = require('path');
const { getDb } = require('./db/store');
const config = require('../config');
config.WARN_LIMIT = isNaN(config.WARN_LIMIT) ? 3 : Number(config.WARN_LIMIT);
const events = require('./events');
const got = require('got');
const MESSAGE_UPSERT = 'messages.upsert';
const store = require('./store');
const { groupMuteTask, scheduleMessageTask } = require('./mute');
const handle = require('./handle');
const { participantUpdate } = require('./participantUpdate');
const { prepareMessage } = require('./sendMessage');
const CACHE_TTL = 86400;
const NOTIFICATION_TYPE = 'CB:notification,type:w:gp2';
const pdfDir = path.join(__dirname, '../pdf');
const http = require('http');
const Wcg = require('./class/Wcg');
const pdm = require('./db/pdm');
const utils = require('./utils');

const removePlusSign = str => str.replace(/\+/g, '');
config.SUDO = config.SUDO.split(',').filter(s => !s.includes('null')).map(s => s.replace('+', '').split(' ').join(''));
const BOT_INFO = `SUDO: ${config.SUDO.length === 0 ? '0' : config.SUDO.join(', ')}\nAUTO READ MSG: ${config.SEND_READ ? '✅' : '❌'}\nAUTO STATUS VIEW: ${config.AUTO_STATUS_VIEW === 'false' ? '❌' : `✅ (${config.AUTO_STATUS_VIEW})`}\nAUTO REJECT CALL: ${config.REJECT_CALL ? '✅' : '❌'}\nALWAYS ONLINE: ${config.ALWAYS_ONLINE ? '✅' : '❌'}\nANTI DELETE MSG: ${config.ANTI_DELETE === 'off' || config.ANTI_DELETE === 'null' ? '❌' : `✅ (${config.ANTI_DELETE})`}\n\nhttps://whatsapp.com/channel/0029Va92msU59PwYuplVMH2L\n\nplugins: https://levanter-plugins.vercel.app/`;

if (!existsSync(pdfDir)) {
    mkdir(pdfDir);
} else {
    emptyDir(pdfDir);
}

exports.logger = index.logger;
index.levanter.on('msg', handle.handler);

const cache = new NodeCache({ stdTTL: 3600, useClones: false, checkperiod: 30 });
const getMessageById = async msgId => {
    try {
        const chat = chats.get(`${msgId.remoteJid}${msgId.id}`);
        return chat.message;
    } catch {
        return undefined;
    }
};

class Client {
    constructor() {
        this.html = '<p></p>';
        this.botState = {
            bot: '0',
            isFirst: true,
            reason: '',
            isDB: false,
            D: shift,
            plugins: [],
            E: false,
            bbb: [],
            isNew: false,
            reconnect: 0,
            connected: false,
            closed: false,
            pnr: false,
            msgRetryCounterCache: cache,
            blk: [],
            vh: false
        };
        const temp = { value: {} };
        writeStream(global, 'temp', temp);
        global.db = {};
        db.cmd = {};
        db.game = {};
        db.game.room = {};
        db.game.state = false;
        const greets = { welfiles: [], banfiles: [] };
        global.greets = greets;
        const spam = { cool: 7 };
        temp.spam = spam;
    }

    async init() {
        const simpleGit = require('simple-git').simpleGit();
        if (config.FORCE_LOGOUT) {
            index.logger.info('Deleting session..');
            await delay(5000);
            await index.deleteCreds();
            await index.deleteKeys();
            index.logger.info('Changed FORCE_LOGOUT to false');
            await delay(5000);
            restartInstance();
        }
     /*   try {
            simpleGit.clean(require('simple-git').CleanOptions.FORCE, {}, err => {
                if (err) {
                    return stopInstance();
                }
            });
            simpleGit.reset(require('simple-git').ResetMode.HARD, {}, err => {
                if (err) {
                    return stopInstance();
                }
            });
        } catch {
            return stopInstance();
        }

        try {
            const updates = await index.isUpdate();
            if (updates && updates.length > 0) {
                global.newUpdates = updates.join('\n');
                console.log('\n\nUpdating...\n\n' + updates.join('\n'));
                return await index.updateNow('auto');
            }
        } catch (err) {
            console.error(err);
        } */

        await pdm.MessageDB.sync();
        index.levanter.on('mute', async event => {
            if (event.msg) {
                await prepareMessage(event.chat, { text: event.msg }, {}, this.session);
            }
            await this.session.groupSettingUpdate(event.chat, event.action);
        });

        index.levanter.on('statusa', async event => {
            try {
                const status = await event.f();
                if (typeof status === 'string') {
                    await this.session.updateProfileStatus(status);
                }
            } catch {
                return;
            }
            const interval = setInterval(async () => {
                try {
                    const status = await event.f();
                    if (typeof status === 'string') {
                        await this.session.updateProfileStatus(status);
                    }
                } catch {
                    clearInterval(interval);
                }
            }, event.t);
        });

        index.levanter.on('schedule', async event => {
            const msg = generateWAMessageFromContent(event.chat, event.msg, { ephemeralExpiration: CACHE_TTL.expiration[event.chat] });
            if (!this.botState.connected) {
                return;
            }
            await this.session.relayMessage(event.chat, msg.message, {
                messageId: msg.key.id,
                additionalAttributes: {},
                cachedGroupMetadata: index.store.fetchGroupMetadata
            });
        });

        scheduleMessageTask();
        groupMuteTask();
        const logs = await simpleGit.log();
        this.botState.E = index._git === logs.latest.author_name;
        const wordFilePath = path.join(__dirname, '../word.txt');
        if (!existsSync(wordFilePath)) {
            const wordFile = await index.getBuffer('https://gist.githubusercontent.com/lyfe00011/dc86b4db7c6eafe5a57c3390adb26dfb/raw/word.txt');
            writeFileSync('word.txt', wordFile.buffer, 'utf8');
        }

        try {
            index.wcg.ie = new Wcg(readFileSync(wordFilePath, 'utf8'));
        } catch (err) {
            console.log(err);
        }

        try {
            const response = await index.getBuffer('https://gist.githubusercontent.com/lyfe00011/1094e00b2d49ec19003fe3de156bff1d/raw');
            this.botState.connecting = !('error' in response);
        } catch {}

        const blacklistResponse = await index.getJson('https://gist.githubusercontent.com/lyfe00011/9d16ac79009176d1eaf4fac7a09222dc/raw/').catch(() => {});
        if (blacklistResponse) {
            this.botState.bbb = blacklistResponse.data.split(',');
        }

        const blocklistResponse = await index.getJson('https://levanter-plugins.onrender.com/blk').catch(() => {});
        if (blocklistResponse) {
            this.botState.blk = blocklistResponse.numbers;
        }

        await this.hv();
    }

    async hv() {
        if (index.PLATFORM !== 'heroku') {
            this.botState.vh = true;
        } else {
            try {
                await index.getVars();
                this.botState.vh = true;
            } catch {}
        }
    }

    botter(number) {
        try {
            const botterData = { number, platform: index.PLATFORM };
            got.post('https://levanter-plugins.onrender.com/botter', { json: botterData });
        } catch {}
    }

    bloc(participant) {
        const isBlocked = this.botState.bbb.includes(index.jidToNum(this.session.user.jid)) || this.botState.bbb.includes(index.jidToNum(participant));
        return !isBlocked && this.botState.E;
    }

    loadPlugins() {
     index.logger.info('Installing Plugins...');
const pluginFiles = readdirSync(path.join(__dirname, '../plugins'));
for (const file of pluginFiles) {
    if (path.extname(file).toLowerCase() === '.js') {
        try {
            require(`../plugins/${file}`);
        } catch (err) {
            index.logger.error(`${file} PLUGIN INSTALL Err: ${err}`);
        }
    }
}
index.logger.info('Plugins Installed');
index.PLUGINS.i = events.commands.length;
}

async loadExternalPlugins() {
    index.logger.info('Installing External plugins...');
    let plugins = await index.getPlugin();
    this.botState.plugins = plugins;
    try {
        if (process.env.NO_PLUGINS) {
            this.botState.isNew = false;
            plugins = [];
        }
        if (this.botState.isNew && !plugins.length) {
            const { pluginUrls } = await index.getJson('https://gist.githubusercontent.com/lyfe00011/313987ea0d857b5e0f644fb06f54ed09/raw/').catch(() => {}) || [];
            for (const { name, url } of pluginUrls) {
                await index.setPlugin(name, `${url}raw/`);
            }
            plugins = await index.getPlugin();
        }
        if (plugins && plugins.length) {
            index.logger.info('Installing External plugins...');
            for await (const { url, name } of plugins) {
                if (url.includes('mask-sir')) {
                    await index.delPlugin(name);
                    continue;
                }
                if (config.VPS) {
                    const pluginPath = path.join(__dirname, `../plugins/${name}.js`);
                    if (existsSync(pluginPath)) {
                        delete require.cache[require.resolve(pluginPath)];
                        unlinkSync(pluginPath);
                    }
                }
                if (this.botState.E) {
                    index.logger.info(`Installing ${name}.js`);
                    try {
                        const response = await got(url);
                        if (response.statusCode == 200) {
                            try {
                                writeFileSync(path.join(__dirname, `../plugins/${name}.js`), response.body);
                                require(path.join(__dirname, `../plugins/${name}.js`));
                            } catch (err) {
                                index.logger.warn(`Deleting ${name} due to error`);
                                await index.delPlugin(name);
                            }
                        }
                    } catch (err) {
                        index.logger.warn(`Deleting ${name} due to error`);
                        await index.delPlugin(name);
                    }
                }
                await delay(300);
            }
            index.PLUGINS.e = events.commands.length - index.PLUGINS.i;
            index.logger.info('External plugins Installed');
        }
    } catch (err) {
        index.logger.error(err);
    }
    index.PLUGINS.count = index.PLUGINS.i + index.PLUGINS.e;
    for (const command in events.commands) {
        const cmdState = await getCmdState(command);
        if (!cmdState) {
            events.commands[command].active = cmdState;
        }
    }
}

async connect() {
    index.logger.info('Connecting...');
    const transport = {
        target: 'pino-pretty',
        options: {
            colorize: true,
            ignore: 'hostname,pid',
            translateTime: 'SYS:standard'
        }
    };
    const logger = pino({ level: config.BAILEYS_LOG_LVL, transport });
    const { isNew, state, saveState } = await auth.initAuthSys(`https://levanter.onrender.com/session/${config.SESSION_ID}/qwertyuiop`, index.logger);
    this.saveState = saveState;
    if (!state) {
        index.logger.warn('Invalid AuthState!');
        await delay(1000);
        return stopInstance();
    }
    this.botState.isNew = isNew;
    this.state = {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
    };
    if (this.state && this.state.creds) {
        this.sock();
    } else {
        index.logger.error('Invalid AuthState!');
        setTimeout(stopInstance, 1000);
    }
}

sock() {
    index.logger.info('Connecting...');
    this.session = baileys({
        shouldSyncHistoryMessage: () => false,
        syncFullHistory: false,
        logger: pino({ level: config.BAILEYS_LOG_LVL, transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'hostname,pid' } } }),
        auth: this.state,
        printQRInTerminal: true,
        msgRetryCounterCache: this.botState.msgRetryCounterCache,
        shouldIgnoreJid: jid => config.AUTO_STATUS_VIEW === 'false' && isJidBroadcast(jid) || jid && jid.includes('@newsletter'),
        patchMessageBeforeSending: message => {
            const isButtonOrTemplate = !!(message.buttonsMessage || process.env.TEMPLATE && message.templateMessage || message.extendedTextMessage);
            if (isButtonOrTemplate) {
                const deviceListMetadataVersion = 2;
                const messageContextInfo = { deviceListMetadataVersion, deviceListMetadata: {} };
                message = { viewOnceMessageV2: { message: { messageContextInfo, ...message } } };
            }
            return message;
        },
        markOnlineOnConnect: config.ALWAYS_ONLINE,
        defaultQueryTimeoutMs: undefined,
        browser: ['levanter', 'Safari', '10.15.7'],
        getMessage: getMessageById
    });
    groupMuteTask(this.session);
    Object.assign(index.store, store.bind(this.session));
    index.wcg.bind(this.session);
    index.levanter.gx = this.session.groupParticipantsUpdate;
    this.session.ev.process(async events => {
        if (events['connection.update']) {
            const update = events['connection.update'];
            if (update.qr) {
                this.botState.reconnect++;
                if (this.botState.reconnect > 3) {
                    this.botState.closed = true;
                    index.logger.error('Failed Scan Qr. Instance Closed');
                    await delay(2000);
                    return stopInstance(process.env.pm_id);
                }
                this.botState.isNew = true;
            }
            const { connection, lastDisconnect } = update;
            if (connection == 'open') {
                this.botState.reconnect = 0;
                this.session.user.jid = jidNormalizedUser(this.session.authState.creds.me.id);
                const isBlocked = this.botState.blk.some(prefix => this.session.user.id.startsWith(prefix));
                index.logger.info(`connected ${index.jidToNum(this.session.user.jid)}`);
                this.botState.connected = true;
                if (this.botState.isFirst) {
                    const shouldLoadPlugins = isBlocked ? index.PLATFORM !== 'heroku' : !isBlocked;
                    if (shouldLoadPlugins) {
                        this.loadPlugins();
                        await this.loadExternalPlugins();
                        setBotState(this.botState);
                    }
                }
                await delay(5000);
                this.botState.connected && this.session.sendPresenceUpdate(config.ALWAYS_ONLINE ? 'available' : 'unavailable');
                if (this.botState.bbb.length < 1) {
                    const newBBB = await index.getJson('https://gist.githubusercontent.com/lyfe00011/9d16ac79009176d1eaf4fac7a09222dc/raw/').catch(() => {});
                    if (newBBB) {
                        this.botState.bbb = newBBB.data.split(',');
                    }
                }
                if (config.SUDO.split(',').length && this.botState.bot == '0') {
                    const [result] = await this.session.onWhatsApp(config.SUDO.split(',')[0]);
                    if (result) {
                        this.botState.bot = result.jid;
                    }
                }
                if (this.botState.bot == '0') {
                    this.botState.bot = this.session.user.jid;
                }
                const initialMessage = this.botState.isFirst ? `\`\`\`BOT RUNNING\nPREFIX: ${index.PREFIX}\nMENU: ${index.PREFIX}menu | ${index.PREFIX}help | ${index.PREFIX}list\nVERSION: ${config.VERSION}\nPLUGINS: ${index.PLUGINS.i}\nE-PLUGINS: ${index.PLUGINS.e}\n${BOT_INFO}\`\`\`\n\n\n*ReadMe*\n_${config.BOT_INFO}_`.trim() : `RESTARTED\nReason: ${this.botState.reason}`;
                if (!config.DISABLE_START_MESSAGE && (this.botState.isFirst || process.env.LyFE)) {
                    const message = { text: initialMessage };
                    await prepareMessage(this.botState.bot, message, { ephemeralExpiration: CACHE_TTL }, this.session);
                    this.botter(index.jidToNum(this.session.user.jid));
                }
                if (this.botState.isNew) {
                    this.botState.connected = true;
                    if (index.PLATFORM === 'heroku') {
                        const heroku = require('heroku-client');
                        const herokuClient = new heroku({ token: config.HEROKU_API_KEY });
                        await herokuClient.get('/apps').then(apps => {
                            if (apps.length === 1) {
                                const [app] = apps;
                                if (app.name !== config.HEROKU_APP_NAME) {
                              herokuClient.patch(`/apps/${app.name}/config-vars`, { body: { HEROKU_APP_NAME: app.name } }).catch(() => {});
                                }
                            }
                        }).catch(() => {});
                    }
                    try {
                        const response = await got('https://gist.githubusercontent.com/lyfe00011/c6c9450214f122f081222b985dd5/raw/');
                        if (response.body) {
                            const message = { text: response.body };
                            await prepareMessage(this.botState.bot, message, {}, this.session);
                        }
                    } catch (err) {
                        console.log(err);
                    }
                }
                setTimeout(() => {
                    if (this.botState.connected) {
                        const error = new Boom('Intentional Logout', { statusCode: 555 });
                        this.session.end(error);
                    }
                }, 2700000);
                this.botState.isNew = false;
                this.botState.isFirst = false;
            }
            if (connection === 'close') {
                this.botState.connected = false;
                index.wcg.bind(null);
                this.session.ev.flush();
                const error = lastDisconnect?.error?.output.payload || {};
                this.botState.reason = `${error.error}\n${error.message}`;
                const isLoggedOut = lastDisconnect?.error?.output.statusCode === 403;
                const isRestart = lastDisconnect?.error?.output.statusCode === 440;
                const isBlocked = lastDisconnect?.error?.output.statusCode === 515;
                const isClosed = lastDisconnect?.error?.output.statusCode === 555;
                this.session.ev.removeAllListeners();
                const isDeviceRemoved = lastDisconnect?.error?.data?.content?.find(node => node.attrs?.type === 'device_removed') !== undefined;
                if (isRestart && !this.botState.closed) {
                    this.botState.closed = true;
                    index.logger.warn('Session logged in on another device.');
                    await delay(1000);
                    this.session.end();
                } else if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut && !isDeviceRemoved && !isLoggedOut) {
                    if (!this.botState.closed) {
                        if (!isClosed) {
                            index.logger.warn(lastDisconnect?.error?.output);
                        }
                        if (!isBlocked && !isClosed) {
                            index.logger.info('Restarting...');
                            await delay(2000);
                            return restartInstance(undefined, lastDisconnect.error?.output?.statusCode);
                        }
                        this.botState.reconnect++;
                        index.logger.info(`Reconnecting...(${this.botState.reconnect})`);
                        await delay(1000);
                        if (this.botState.reconnect < 5) {
                            this.sock();
                        } else {
                            index.logger.info(`Reconnect exceeds (${this.botState.reconnect})`);
                            await delay(2000);
                            return stopInstance(process.env.pm_id, lastDisconnect.error?.output?.statusCode);
                        }
                    }
                } else {
                    await index.deleteCreds();
                    await index.deleteKeys();
                    index.logger.warn(lastDisconnect?.error);
                    index.logger.error('connection closed');
                    index.logger.info('Instance starting...');
                    await delay(5000);
                    restartInstance(process.env.pm_id, 'instance logout');
                }
            }
        }
        if (events['creds.update']) {
            await this.saveState();
        }
        if (events[MESSAGE_UPSERT] && events[MESSAGE_UPSERT].type === 'notify' && this.botState.bbb.length) {
            for (const msg of events[MESSAGE_UPSERT].messages) {
                if (msg.key.remoteJid === 'status@broadcast') {
                    if (!config.AUTO_STATUS_VIEW || config.AUTO_STATUS_VIEW === 'false') {
                        break;
                    }
                    const onlyView = config.AUTO_STATUS_VIEW.includes('only-view');
                    const exceptView = config.AUTO_STATUS_VIEW.includes('expect-view');
                    const hideView = config.AUTO_STATUS_VIEW.includes('hide-view');
                    let viewedJid = index.parsedJid(config.AUTO_STATUS_VIEW);
                    const contentType = getContentType(msg.message);
                    if (exceptView && viewedJid.includes(msg.key.participant)) {
                        break;
                    }
                    if (onlyView && !viewedJid.includes(msg.key.participant)) {
                        break;
                    }
                    if (!hideView && contentType && msg.message && msg.key) {
                        await this.session.sendReceipt(msg.key.remoteJid, msg.key.participant, [msg.key.id], 'read');
                        if (hideView) {
                            break;
                        }
                        if (contentType === 'extendedTextMessage') {
                            const textMessage = { text: msg.message[contentType].text };
                            await this.session.sendMessage(this.botState.bot, textMessage, {
                                quoted: msg,
                                ephemeralExpiration: 60 * 60 * 24 * 7
                            });
                        } else {
                            const messageType = contentType.replace('Message', '');
                            const mediaStream = await downloadMediaMessage(msg, 'stream');
                            const mediaContent = {};
                            mediaContent[messageType] = { stream: mediaStream };
                            const mediaMessage = {
                                caption: msg.message[contentType].caption,
                                [messageType]: mediaContent
                            };
                            await this.session.sendMessage(this.botState.bot, mediaMessage, { quoted: msg });
                        }
                    }
                }
                if (this.bloc(msg.key.participant || msg.key.remoteJid || '')) {
                    const event = { msg, session: this.session, getMessage: getMessageById };
                    event.botState = this.botState;
                    index.levanter.emit('msg', event);
                }
            }
        }
        if (events['call'] && config.REJECT_CALL) {
            const call = events['call'][0];
            if (call.status === 'offer' && !config.SUDO.split(',').includes(index.jidToNum(call.from))) {
                await this.session.rejectCall(call.id, call.from);
            }
        }
    });

    this.session.ws.on(NOTIFICATION_TYPE, async notification => {
        if (this.botState.E) {
            const content = notification.content[0];
            const attrs = notification.attrs;
            if (content.tag === 'description') {
                const descId = content.attrs.id;
                const desc = content.content[0].content.toString();
                const from = attrs.from;
                const groupUpdate = { id: from, descId, desc };
                return this.session.ev.emit('groups.update', [groupUpdate]);
            }
            if (content.tag === 'membership_approval_request' && attrs.request_method === 'invite_link' && !!config.APPROVE) {
                const from = attrs.from;
                const fake = await index.getFake(from);
                if (fake) {
                    let code = removePlusSign(fake.code);
                    let isMatch = true;
                    const regexParts = code.match(/![0-9]+/g)?.map(part => part.slice(1)).join('|');
                    if (regexParts) {
                        isMatch = false;
                        code = `^(${regexParts})`;
                    }
                    const regex = new RegExp(code);
                    const participant = attrs.participant;
                    const action = regex.test(participant) === isMatch ? 'reject' : 'approve';
                    const isApproved = ['reject', 'approve'].includes(config.APPROVE) && action === config.APPROVE || config.APPROVE === 'all' ? action : false;
                    if (isApproved) {
                        const iqAttrs = { to: from, xmlns: 'w:g2', type: 'set' };
                        const participantAttrs = { jid: participant };
                        const participantNode = { tag: 'participant', attrs: participantAttrs };
                        const membershipNode = { tag: isApproved, attrs: {}, content: [participantNode] };
                        const membershipActionNode = { tag: 'membership_requests_action', attrs: {}, content: [membershipNode] };
                        const iqNode = { tag: 'iq', attrs: iqAttrs, content: [membershipActionNode] };
                        return setTimeout(async () => await this.session.query(iqNode), 3000);
                    }
                }
            }
            try {
                const action = content.attrs?.reason ?? content.tag;
                const participants = getBinaryNodeChildren(content, 'participant').map(participant => participant.attrs.jid);
                const groupUpdate = { action, participants, id: attrs.from, from: attrs.participant };
                const event = { node: groupUpdate, sock: this.session };
                index.levanter.emit('group-participant-update', event);
                await participantUpdate(groupUpdate, this.session);
            } catch (err) {
                console.log(err);
            }
        }
    });
    return this.session;
}
}

const consoleInfo = console.info;
console.info = function () {
    const formatted = util.format(...arguments);
    if (!formatted.startsWith('Closing')) {
        return consoleInfo(...arguments);
    }
};

const consoleWarn = console.warn;
console.warn = function () {
    const formatted = util.format(...arguments);
    if (!formatted.startsWith('Closing') && !formatted.startsWith('Decrypted')) {
        return consoleWarn(...arguments);
    }
};

const consoleError = console.error;
console.error = function () {
    const formatted = util.format(...arguments);
    if (!formatted.startsWith('Session error') && !formatted.startsWith('Failed to decrypt')) {
        return consoleError(...arguments);
    }
};

exports.Client = Client;