const { DataTypes } = require('sequelize');
const config = require('../../config');

const antiLinkSchema = {
  chat: {
    type: DataTypes.STRING,
    allowNull: false
  },
  context: {
    type: DataTypes.TEXT,
    allowNull: false
  }
};
const AntiLink = config.DATABASE.define('antiLink', antiLinkSchema);

const antiWordSchema = {
  chat: {
    type: DataTypes.STRING,
    allowNull: false
  },
  context: {
    type: DataTypes.TEXT,
    allowNull: false
  }
};
const AntiWord = config.DATABASE.define('antiWord', antiWordSchema);

const antiSpamSchema = {
  chat: {
    type: DataTypes.STRING,
    allowNull: false
  },
  context: {
    type: DataTypes.TEXT,
    allowNull: false
  }
};
const AntiSpam = config.DATABASE.define('antiSpam', antiSpamSchema);

const cache = {
  antilink: {},
  spam: {},
  word: {}
};

const normalizeCSV = (str) => str.split(',').map(item => item.trim()).join(',');

exports.setAntiLink = async (chatId, setting) => {
  delete cache.antilink[chatId];
  const isEnabled = typeof setting === 'boolean' ? setting : undefined;
  const action = /action\/(kick|warn|null)/.test(setting) ? setting.replace('action/', '') : undefined;
  const allowedUrls = action === undefined && isEnabled === undefined ? setting : undefined;

  const criteria = { chat: chatId };
  const options = { where: criteria };
  const record = await AntiLink.findOne(options);

  if (!record) {
    const newRecord = {
      enabled: isEnabled ?? false,
      action: action || 'kick',
      allowedUrls: normalizeCSV(allowedUrls || 'null')
    };
    await AntiLink.create({ chat: chatId, context: JSON.stringify(newRecord) });
  } else {
    const existingRecord = JSON.parse(record.context);
    Object.assign(existingRecord, {
      enabled: isEnabled ?? existingRecord.enabled,
      action: action ?? existingRecord.action,
      allowedUrls: normalizeCSV(allowedUrls || existingRecord.allowedUrls)
    });
    await record.update({ chat: chatId, context: JSON.stringify(existingRecord) });
  }

  const urls = allowedUrls || JSON.parse(record.context).allowedUrls;
  const urlList = urls.split(',');
  const allowed = urlList.filter(url => !url.startsWith('!'));
  return {
    notallow: urlList.filter(url => !allowed.includes(url)).map(url => url.replace('!', '')),
    allow: allowed
  };
};

exports.getAntiLink = async (chatId) => {
  if (chatId in cache.antilink) {
    return cache.antilink[chatId];
  }

  const criteria = { chat: chatId };
  const options = { where: criteria };
  const record = await AntiLink.findOne(options);

  if (!record) {
    cache.antilink[chatId] = false;
    return false;
  }

  const recordData = JSON.parse(record.context);
  cache.antilink[chatId] = recordData;
  return recordData;
};

exports.setSpam = async (chatId, setting, context = '0') => {
  delete cache.spam[chatId];
  const isEnabled = typeof setting === 'boolean' ? setting : undefined;
  const action = isEnabled === undefined ? setting : undefined;

  const criteria = { chat: context };
  const options = { where: criteria };
  const record = await AntiSpam.findOne(options);

  if (!record) {
    const newRecord = {
      [chatId]: {
        enabled: isEnabled ?? false,
        type: action ?? ''
      }
    };
    return await AntiSpam.create({ chat: context, context: JSON.stringify(newRecord) });
  } else {
    const existingRecord = JSON.parse(record.context);
    Object.assign(existingRecord, {
      [chatId]: {
        enabled: isEnabled ?? existingRecord[chatId]?.enabled ?? false,
        type: action ?? existingRecord[chatId]?.type ?? ''
      }
    });
    return await record.update({ chat: context, context: JSON.stringify(existingRecord) });
  }
};

exports.getSpam = async (chatId, context = '0') => {
  if (chatId in cache.spam) {
    return cache.spam[chatId];
  }

  const criteria = { chat: context };
  const options = { where: criteria };
  const record = await AntiSpam.findOne(options);

  if (!record) {
    const defaultSetting = { enabled: false, type: '' };
    cache.spam[chatId] = defaultSetting;
    return defaultSetting;
  }

  const recordData = JSON.parse(record.context);
  const spamSetting = recordData[chatId] || { enabled: false, type: '' };
  cache.spam[chatId] = spamSetting;
  return spamSetting;
};

exports.setWord = async (chatId, setting, context = '1') => {
  delete cache.word[chatId];
  const isEnabled = typeof setting === 'boolean' ? setting : undefined;
  const action = isEnabled === undefined ? setting : undefined;

  const criteria = { chat: context };
  const options = { where: criteria };
  const record = await AntiWord.findOne(options);

  if (!record) {
    const newRecord = {
      [chatId]: {
        enabled: isEnabled ?? false,
        action: action ?? 'null',
        words: ''
      }
    };
    return await AntiWord.create({ chat: context, context: JSON.stringify(newRecord) });
  } else {
    const existingRecord = JSON.parse(record.context);
    Object.assign(existingRecord, {
      [chatId]: {
        enabled: isEnabled ?? existingRecord[chatId]?.enabled ?? false,
        action: action ?? existingRecord[chatId]?.action ?? 'null',
        words: ''
      }
    });
    return await record.update({ chat: context, context: JSON.stringify(existingRecord) });
  }
};

exports.getWord = async (chatId, context = '1') => {
  if (chatId in cache.word) {
    return cache.word[chatId];
  }

  const criteria = { chat: context };
  const options = { where: criteria };
  const record = await AntiWord.findOne(options);

  if (!record) {
    const defaultSetting = { enabled: false, action: 'null', words: '' };
    cache.word[chatId] = defaultSetting;
    return defaultSetting;
  }

  const recordData = JSON.parse(record.context);
  const wordSetting = recordData[chatId] || { enabled: false, action: 'null', words: '' };
  cache.word[chatId] = wordSetting;
  return wordSetting;
};
