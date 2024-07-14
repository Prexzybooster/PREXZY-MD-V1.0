const sharp = require('sharp');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');
const validationString = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const { iChecker } = require('./test/test');
const checkResult = iChecker();
const NodeCache = require('node-cache');

const cacheOptions = {
    stdTTL: 300,
    useClones: false
};
exports.chats = new NodeCache(cacheOptions);

if (checkResult === validationString) {
    const generateThumbnail = async (input, width = 64, height = 64) => {
        const resizedImageBuffer = await sharp(input)
            .resize(width, height, { fit: 'inside' })
            .jpeg({ quality: height })
            .toBuffer();
        return resizedImageBuffer.toString('base64');
    };
    exports.genThumbnail = generateThumbnail;

    exports.writeStream = (stream, property, descriptor) => {
        Object.defineProperty(stream, property, descriptor);
    };

    const extractVideoDuration = async (filePath) => {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (error, metadata) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(metadata.format.duration);
                }
            });
        });
    };

    exports.extractVideoThumb = (videoBuffer) => {
        return new Promise(async (resolve, reject) => {
            const tempVideoPath = `./${Date.now()}.mp4`;
            const tempThumbnailPath = `${tempVideoPath}.jpg`;
            fs.writeFileSync(tempVideoPath, videoBuffer);
            const thumbnailCommand = `ffmpeg -ss 00:00:00.000 -i ${tempVideoPath} -vframes 1 ${tempThumbnailPath}`;
            const duration = await extractVideoDuration(tempVideoPath);

            exec(thumbnailCommand, async (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({
                        duration,
                        thumbnail: await generateThumbnail(fs.readFileSync(tempThumbnailPath))
                    });
                    fs.unlinkSync(tempVideoPath);
                    fs.unlinkSync(tempThumbnailPath);
                }
            });
        });
    };

    const calculateDimensions = (width, height, factor = 1) => {
        if (width > 720 || height > 720) {
            factor++;
            const aspectRatio = height / width;
            width = width / factor;
            height = aspectRatio * width;
            return calculateDimensions(width, height, factor);
        }
        return {
            width: Math.floor(width),
            height: Math.floor(height)
        };
    };

    exports.getImgRes = async (input, resize = false) => {
        const image = sharp(input);
        const metadata = await image.metadata();
        const { width, height } = metadata;
        return resize ? calculateDimensions(width, height) : { width, height };
    };

    exports.genProPic = async (input, width = 720, height = 720, quality = 100) => {
        return await sharp(input)
            .resize(width, height, { fit: 'inside' })
            .jpeg({ quality })
            .toBuffer();
    };
}