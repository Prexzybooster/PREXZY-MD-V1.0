const { getFake, setFake } = require('./fake');
const {
    getMention,
    enableMention,
    mentionMessage,
    setPmMessage,
    getPmMessage
} = require('./mention');

const encodedKey = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const { iChecker } = require('../test/test');
const checkerResult = iChecker();
const isValidKey = checkerResult == encodedKey;

if (isValidKey) {
    const team = require('./team');
    const budget = require('./budget');
    const {
        getCreds,
        setCreds,
        setKeys,
        restoreKeys,
        deleteCreds,
        deleteKeys
    } = require('./session');
    const {
        getMessage,
        deleteMessage,
        setMessage
    } = require('./greetings');
    const {
        getPlugin,
        setPlugin,
        delPlugin
    } = require('./plugins');
    const devilFruits = require('./nr');
    exports.zushi = devilFruits.zushi;
    exports.yami = devilFruits.yami;
    exports.ope = devilFruits.ope;
    exports.logia = devilFruits.logia;
    const {
        setAntiLink,
        getAntiLink,
        setSpam,
        getSpam,
        getWord,
        setWord
    } = require('./antilink');
    exports.setAntiLink = setAntiLink;
    exports.getAntiLink = getAntiLink;
    exports.setSpam = setSpam;
    exports.getSpam = getSpam;
    exports.setWord = setWord;
    exports.getWord = getWord;
    const {
        setLydia,
        getTruecaller,
        setTruecaller,
        delTruecaller
    } = require('./lydia');
    exports.setLydia = setLydia;
    exports.getTruecaller = getTruecaller;
    exports.setTruecaller = setTruecaller;
    exports.delTruecaller = delTruecaller;
    const {
        getPdm,
        setPdm,
        getTMessage,
        setTMessage,
        getDeletedMessage
    } = require('./pdm');
    const {
        getWarnCount,
        setWarn,
        deleteWarn
    } = require('./warn');
    const {
        setMute,
        getMute,
        delScheduleMessage,
        getScheduleMessage
    } = require('./mute');
    const {
        getFilter,
        setFilter,
        delFilter
    } = require('./filter');
    
    // Exporting functions
    exports.setTMessage = setTMessage;
    exports.getTMessage = getTMessage;
    exports.getDeletedMessage = getDeletedMessage;
    exports.getFilter = getFilter;
    exports.setFilter = setFilter;
    exports.deleteFilter = delFilter;
    exports.deleteWarn = deleteWarn;
    exports.getMute = getMute;
    exports.setMute = setMute;
    exports.getWarnCount = getWarnCount;
    exports.setWarn = setWarn;
    exports.setPdm = setPdm;
    exports.getPdm = getPdm;
    exports.delScheduleMessage = delScheduleMessage;
    exports.getScheduleMessage = getScheduleMessage;
    exports.getCreds = getCreds;
    exports.getMention = getMention;
    exports.setCreds = setCreds;
    exports.setKeys = setKeys;
    exports.restoreKeys = restoreKeys;
    exports.deleteCreds = deleteCreds;
    exports.deleteKeys = deleteKeys;
    exports.enableMention = enableMention;
    exports.mentionMessage = mentionMessage;
    exports.deleteMessage = deleteMessage;
    exports.setMessage = setMessage;
    exports.getMessage = getMessage;
    exports.getFake = getFake;
    exports.setFake = setFake;
    exports.getPlugin = getPlugin;
    exports.setPlugin = setPlugin;
    exports.delPlugin = delPlugin;
    exports.setBudget = budget.setBudget;
    exports.getBudget = budget.getBudget;
    exports.delBudget = budget.detBudget;
    exports.setPmMessage = setPmMessage;
    exports.getPmMessage = getPmMessage;
}