const secretKey = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';

const { iChecker: checker } = require('../test/test');
const result = checker();

const isKeyValid = result === secretKey;

if (isKeyValid) {
    const { instagram } = require('./insta');
    const { facebook } = require('./facebook');
    const { story } = require('./story');
    const { tiktok } = require('./tiktok');
    const { twitter } = require('./twitter');
    const { y2mate } = require('./y2mate');
    const { pinterest } = require('./pinterest');
    const { webpToMp4 } = require('./webp');
    const { mediafire } = require('./mediafire');
    const { apkMirror } = require('./apkmirror');
    const { reddit } = require('./reddit');

    exports.instagram = instagram;
    exports.facebook = facebook;
    exports.story = story;
    exports.tiktok = tiktok;
    exports.twitter = twitter;
    exports.y2mate = y2mate;
    exports.pinterest = pinterest;
    exports.webpToMp4 = webpToMp4;
    exports.mediafire = mediafire;
    exports.apkMirror = apkMirror;
    exports.reddit = reddit;
}
