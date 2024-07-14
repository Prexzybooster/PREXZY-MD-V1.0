const cron = require('node-cron');
const scheduleManager = {
    mute: {},
    unmute: {},
    schedule: []
};

const { getAllMute, getScheduleMessage, setScheduleMessage } = require('./db/mute');
const utils = require('./utils');

exports.validateTime = timeString => {
    if (!timeString || !timeString.length) {
        return timeString;
    }
    const timeParts = timeString.split('-');
    const formattedParts = ['*', '*', '*', '*', '*'].map((part, index) => {
        if (!timeParts[index]) {
            return '*';
        }
        part = timeParts[index];
        return isNaN(part) && !part.includes('*/') ? '*' : part.trim();
    });
    const cronString = formattedParts.join(' ');
    const isValid = cron.validate(cronString);
    return isValid ? cronString : isValid;
};

const addTask = (chat, action, hour, minute, message) => {
    const taskExists = scheduleManager[action][chat];
    if (action === 'off') {
        if (!taskExists) {
            return false;
        }
        taskExists.task.stop();
        delete scheduleManager[action][chat];
        return true;
    }

    const isValidCron = cron.validate(`${minute} ${hour} * * *`);
    if (!isValidCron || (action !== 'mute' && action !== 'unmute')) {
        return;
    }

    const scheduledTask = cron.schedule(`${minute} ${hour} * * *`, () => {
        console.log(`${action.replace('e', 'ing')} ${chat}`);
        const msgObject = {
            chat: chat,
            msg: message || undefined,
            action: action === 'mute' ? 'muting' : 'unmuting'
        };
        utils.levanter.emit(action, msgObject);
    }, {
        scheduled: true,
        timezone: process.env.TZ || 'Asia/Kolkata'
    });

    if (taskExists) {
        taskExists.task.stop();
        delete scheduleManager[action][chat];
    }

    scheduleManager[action][chat] = { task: scheduledTask };
    return true;
};

exports.addTask = addTask;

exports.groupMuteTask = async () => {
    const mutes = await getAllMute();
    for (const muteItem of mutes) {
        const { mute, unmute } = JSON.parse(muteItem.jsonData);
        if (mute.enabled) {
            addTask(muteItem.chat, 'mute', mute.hour, mute.minute, mute.msg);
        }
        if (unmute.enabled) {
            addTask(muteItem.chat, 'unmute', unmute.hour, unmute.minute, unmute.msg);
        }
    }
};

const emitSchedule = task => utils.levanter.emit('schedule', task);

const scheduleMessageTask = async (chat, time, message, shouldSave) => {
    if (shouldSave) {
        message = await setScheduleMessage(chat, time, message);
    }
    const taskData = {
        chat: chat,
        msg: message
    };
    const cronOptions = { scheduled: true };
    cronOptions.timezone = process.env.TZ || 'Asia/Kolkata';
    const task = cron.schedule(time, () => emitSchedule(taskData), cronOptions);
    const taskObject = {
        chat: chat,
        time: time,
        task: task
    };
    scheduleManager.schedule.push(taskObject);
};

exports.scheduleMessageTask = async () => {
    const messages = await getScheduleMessage(0, 1);
    for (const msg of messages) {
        await scheduleMessageTask(msg.chat, msg.time, JSON.parse(msg.msg));
    }
};

exports.deleteScheduleTask = async (chat, time) => {
    const task = scheduleManager.schedule.find(t => t.chat === chat && t.time === time);
    if (task) {
        task.task.stop();
    }
};

exports.createSchedule = scheduleMessageTask;