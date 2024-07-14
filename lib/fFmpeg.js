const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const { exec } = require('child_process');
const webpmux = require('node-webpmux');
const config = require('../config');
const fsExtra = require('fs-extra');
const path = require('path');
const { ytJsong } = require('./utils');
const { iChecker } = require('./test/test');
const googleTTS = require('google-tts-api');
const sharp = require('sharp');

const token = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const isAuthorized = iChecker() === token;

const deleteFile = (filePath) => {
  if (!filePath.includes('mention')) {
    fs.unlink(filePath, () => {});
  }
};

if (isAuthorized) {
  const [packName, packPublisher] = config.STICKER_PACKNAME === 'false' ? [] : config.STICKER_PACKNAME.split(',');

  const addExif = async (imagePath, packName = packPublisher, emojis = ['❤️'], options = {}) => {
    const stickerPackID = 'a855bd0000000000000000000000000000000000'; // example sticker pack ID
    const image = new webpmux.Image();
    await image.load(imagePath);

    const exifData = {
      'sticker-pack-id': stickerPackID,
      'sticker-pack-name': packName,
      'sticker-pack-publisher': packPublisher,
      'emojis': emojis,
      ...options
    };

    image.exif = Buffer.concat([
      Buffer.from([73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 65, 87, 7, 0, 0, 0, 0, 0, 22, 0, 0, 0]),
      Buffer.from(JSON.stringify(exifData), 'utf8')
    ]);

    return await image.save(null);
  };

  exports.addExif = addExif;

  exports.getFfmpegBuffer = async (input, output, options) => {
    try {
      return await new Promise((resolve, reject) => {
        ffmpeg(input).outputOptions(options).save(output).on('error', err => reject(new Error(err.message))).on('end', async () => {
          deleteFile(input);
          const buffer = fs.readFileSync(output);
          deleteFile(output);
          resolve(buffer);
        });
      });
    } catch (err) {
      console.error(err);
    }
  };

  exports.cropSticker = (input, output, type = 1, emoji = '❤️') => {
    let options = [
      '-vcodec', 'libwebp', '-vf', 'scale=512:512,setsar=1,fps=20', '-loop', '0', '-lossless 0', '-preset default', '-an', '-vsync 0', '-s 512:512'
    ];
    if (type === 2) options = [
      '-vcodec', 'libwebp', '-vf', 'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1,fps=15', '-loop', '0', '-lossless 1', '-preset default', '-an', '-vsync 0', '-s 512:512'
    ];
    if (type === 3) options = [
      '-vcodec', 'libwebp', '-vf', 'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1,fps=20', '-loop', '0', '-lossless 1', '-preset default', '-an', '-vsync 0', '-s 512:512'
    ];

    return new Promise((resolve, reject) => {
      ffmpeg(output).outputOptions(options).save(`${input}c.webp`).on('error', err => reject(new Error(err.message))).on('end', async () => {
        const result = await addExif(`${input}c.webp`, undefined, undefined, [emoji]).catch(err => new Error(err.message));
        deleteFile(output);
        deleteFile(`${input}c.webp`);
        resolve(result);
      });
    });
  };

  exports.sticker = (input, output, type = 1, emoji = '❤️') => {
    let options = [
      '-vcodec', 'libwebp', '-vf', 'scale=2006:2006:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=2006:2006:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1'
    ];
    if (type === 2) options = [
      '-vcodec', 'libwebp', '-vf', 'scale=2006:2006:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=2006:2006:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1,fps=20'
    ];
    if (type === 3) options = [
      '-vcodec', 'libwebp', '-vf', 'scale=2006:2006:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=2006:2006:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1,fps=15'
    ];

    return new Promise((resolve, reject) => {
      ffmpeg(output).addOutputOptions(options).save(`${input}.webp`).on('error', err => reject(new Error(err.message))).on('end', async () => {
        const result = await addExif(fs.readFileSync(`${input}.webp`), undefined, undefined, [emoji]).catch(err => reject(new Error(err.message)));
        deleteFile(output);
        deleteFile(`${input}.webp`);
        resolve(result);
      });
    });
  };

  exports.song = async (url) => {
    try {
      const songData = await ytJsong(url);
      if (!songData) {
        return false;
      }

      const outputPath = path.join(__dirname, `../${url}.mp3`);
      const inputPath = path.join(__dirname, `../${url}.m4a`);

      return new Promise((resolve, reject) => {
        ffmpeg(inputPath).audioBitrate(192).audioFrequency(44100).save(outputPath).on('error', err => reject(new Error(err.message))).on('end', () => {
          const songBuffer = fs.readFileSync(outputPath);
          fs.unlink(outputPath, () => {});
          fs.unlink(inputPath, () => {});
          resolve(songBuffer);
        });
      });
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  exports.audioCut = (input, startTime, duration, output = 'cut') => {
    return new Promise((resolve, reject) => {
      ffmpeg(input).setStartTime(startTime).setDuration(duration).save(`${output}.mp3`).on('error', err => reject(new Error(err.message))).on('end', () => {
        const buffer = fs.readFileSync(`${output}.mp3`);
        deleteFile(input);
        deleteFile(`${output}.mp3`);
        resolve(buffer);
      });
    });
  };

  exports.avm = (files) => {
    files = files.reverse();
    return new Promise((resolve, reject) => {
      let command = ffmpeg();
      files.forEach(file => command.input(path.join(__dirname, `../media/avm/${file}`)));

      command.outputOptions(['-map 0:v', '-map 1:a', '-c:v copy', '-shortest']);
      command.save('audvid.mp4').on('error', err => reject(new Error(err.message))).on('end', () => {
        fsExtra.emptyDirSync(path.join(__dirname, '../media/avm'));
        const buffer = fs.readFileSync('audvid.mp4');
        deleteFile('audvid.mp4');
        resolve(buffer);
      });
    });
  };
exports.videoHeightWidth = async (filePath) => {
    const { streams } = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
    return {
        height: streams[0].height,
        width: streams[0].width
    };
};

exports.videoTrim = (input, startTime, duration) => {
    return new Promise((resolve, reject) => {
        ffmpeg(input)
            .setStartTime(startTime.trim())
            .setDuration(duration.trim())
            .videoCodec('copy')
            .audioCodec('copy')
            .on('error', err => reject(new Error(err.message)))
            .save('videotrim.mp4')
            .on('end', async () => {
                const buffer = fs.readFileSync('videotrim.mp4');
                deleteFile('videotrim.mp4');
                deleteFile(input);
                resolve(buffer);
            });
    });
};

exports.mergeVideo = (videoCount) => {
    return new Promise((resolve, reject) => {
        let fileList = '';
        for (let i = 1; i <= videoCount; i++) {
            fileList += `file '../media/merge/${i}.mp4'\n`;
        }
        fs.writeFileSync('video.txt', fileList);

        exec('ffmpeg -f concat -safe 0 -i video.txt -c copy merge.mp4', (error) => {
            if (error) {
                fsExtra.emptyDirSync(path.join(__dirname, '../media/merge'));
                reject(new Error('ffmpeg execution failed'));
            } else {
                fsExtra.emptyDirSync(path.join(__dirname, '../media/merge'));
                const buffer = fs.readFileSync('merge.mp4');
                deleteFile('merge.mp4');
                resolve(buffer);
            }
        });
    });
};

exports.blackVideo = (input) => {
    return new Promise((resolve, reject) => {
        exec(`ffmpeg -y -i ${input} toblack.aac`, () => {
            exec(`ffmpeg -y -loop 1 -framerate 1 -i ${path.join(__dirname, '../media/black.jpg')} -i toblack.aac -c:v libx264 -preset ultrafast -tune stillimage -vf scale='min(iw,512):min(ih,512)' -c:a copy -shortest black.mp4`, (error) => {
                if (error) {
                    reject(new Error('black video creation failed'));
                } else {
                    const buffer = fs.readFileSync('black.mp4');
                    deleteFile(input);
                    deleteFile('black.mp4');
                    deleteFile('toblack.aac');
                    resolve(buffer);
                }
            });
        });
    });
};

exports.cropVideo = (input, width, height, x, y) => {
    return new Promise((resolve, reject) => {
        exec(`ffmpeg -y -i ${input} -vf "crop=${width}:${height}:${x}:${y}" -c:v libx264 -crf 1 -c:a copy croped.mp4`, (error) => {
            if (error) {
                reject(new Error('crop failed'));
            } else {
                const buffer = fs.readFileSync('croped.mp4');
                deleteFile('croped.mp4');
                deleteFile(input);
                resolve(buffer);
            }
        });
    });
};

exports.gifToVideo = async (input) => {
    const output = `${input}.mp4`;
    return new Promise((resolve, reject) => {
        ffmpeg(input)
            .outputOptions([
                '-pix_fmt yuv420p',
                '-c:v libx264',
                '-movflags +faststart',
                '-filter:v crop=\'floor(in_w/2)*2:floor(in_h/2)*2\''
            ])
            .save(output)
            .on('error', err => reject(new Error(err.message)))
            .on('end', () => {
                const buffer = fs.readFileSync(output);
                deleteFile(input);
                deleteFile(output);
                resolve(buffer);
            });
    });
};

exports.videoToGif = async (input) => {
    const output = `${input}.gif`;
    return new Promise((resolve, reject) => {
        ffmpeg(input)
            .save(output)
            .on('error', err => reject(new Error(err.message)))
            .on('end', () => {
                const buffer = fs.readFileSync(output);
                deleteFile(input);
                deleteFile(output);
                resolve(buffer);
            });
    });
};

exports.circleSticker = async (input, isVideo) => {
    const data = isVideo ? await exports.videoToGif(input) : fs.readFileSync(input);
    deleteFile(input);

    const svgBuffer = Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
            <circle cx="256" cy="256" r="256" fill="rgba(0, 0, 0, 0)"/>
        </svg>
    `);

    const options = {
        quality: 100,
        lossless: false
    };

    const circleImage = await sharp(data)
        .resize(512, 512, { fit: 'cover' })
        .composite([{ input: svgBuffer, blend: 'dest-in' }])
        .webp(options)
        .toBuffer();

    return await exports.addExif(circleImage, undefined, undefined, []);
};

exports.SpeechToText = async (lang, text) => {
    try {
        const audioData = await googleTTS.getAllAudioBase64(text, { lang, slow: false, host: 'https://translate.google.com' });
        fs.writeFileSync('tts.mp3', Buffer.from(audioData.map(item => item.base64).join(), 'base64'), { encoding: 'base64' });

        return new Promise((resolve) => {
            ffmpeg('tts.mp3')
                .audioCodec('libopus')
                .save('tts.opus')
                .on('end', () => {
                    const buffer = fs.readFileSync('tts.opus');
                    deleteFile('tts.mp3');
                    deleteFile('tts.opus');
                    resolve(buffer);
                });
        });
    } catch (err) {
        throw new Error(err.message);
    }
};
}