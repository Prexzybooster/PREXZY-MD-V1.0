const { default: axios } = require('axios');
const {
    writeFile,
    readFileSync,
    writeFileSync,
    createWriteStream
} = require('fs-extra');
const path = require('path');
const config = require('../config');
const maxUpload = isNaN(config.MAX_UPLOAD) ? 230 : config.MAX_UPLOAD;
const uploadLimit = Math.min(Number(maxUpload), 1998);
const mimeTypes = {
    mp4: 'video/mp4',
    mp3: 'audio/mpeg',
    png: 'image/png',
    pdf: 'application/pdf',
    zip: 'application/zip',
    apk: 'application/vnd.android.package-archive',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp'
};

const iChecker = require('./test/test').iChecker;
const checkResult = iChecker();
const validCheck = checkResult == 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';

if (validCheck) {
    const https = require('https');
    const http = require('http');

    const getFileMimeType = async (buffer) => {
        const { fileTypeFromBuffer } = await import('file-type');
        const fileType = await fileTypeFromBuffer(buffer);
        return fileType?.mime;
    };

    const getMimeTypeFromExtension = async (fileName) => {
        const extension = fileName.split('.').pop();
        return mimeTypes[extension];
    };

    const extractFileName = (headerValue) => {
        const filenameRegex = new RegExp('filename[^;=\\n]*=((["\']).*?\\2|[^;\\n]*)');
        const matches = filenameRegex.exec(headerValue);
        return matches ? matches[1].replace(/['"]/g, '') : headerValue;
    };

    const downloadedFiles = new Set();

    const getFileNameFromUrl = (url) => {
        const urlObject = new URL(url);
        return path.basename(urlObject.pathname);
    };

    exports.nameFromUrl = getFileNameFromUrl;

    const bufferResponse = (response) => {
        return new Promise((resolve, reject) => {
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', error => reject(error));
        });
    };

    const defaultHeaders = {
        Authorization: 'Basic YXBpLWFwa3VwZGF0ZXI6cm01cmNmcnVVakt5MDRzTXB5TVBKWFc4',
        'User-Agent': 'APKUpdater-v1',
        'Content-Type': 'application/json'
    };

    const axiosConfig = { headers: defaultHeaders };

    const fetchFile = async (url, saveToFile = false, setError = false, isRetry = false) => {
        try {
            const fileName = getFileNameFromUrl(url);
            if (saveToFile && fileName && downloadedFiles.has(fileName)) {
                const fileBuffer = readFileSync(fileName);
                const fileType = await getFileMimeType(fileBuffer);
                return {
                    buffer: fileBuffer,
                    name: fileName,
                    mimetype: fileType,
                    type: fileType?.split('/')[0]
                };
            }

            const config = url.includes('apkmirror') ? axiosConfig : {};
            const agentOptions = { keepAlive: true, rejectUnauthorized: false };
            const agent = url.startsWith('http:') ? new http.Agent(agentOptions) : new https.Agent(agentOptions);
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'arraybuffer',
                agent: agent,
                ...config
            });

            if (response.status !== 200) {
                return { error: true };
            }

            const contentLength = parseFloat(response.headers['content-length']) / (1000 * 1000);
            if (contentLength > uploadLimit) {
                return { buffer: false, size: contentLength };
            }

            let contentType = response.headers['content-type']?.split(';')[0];
            const contentDisposition = response.headers['content-disposition'];
            const finalFileName = contentDisposition ? extractFileName(contentDisposition) : getFileNameFromUrl(response.request.responseUrl);

            if (finalFileName && contentType && contentLength > 80) {
                return {
                    data: true,
                    buffer: response.data,
                    name: finalFileName,
                    size: contentLength,
                    mimetype: contentType,
                    type: contentType?.split('/')[0]
                };
            }

            const buffer = await bufferResponse(response.data);
            if (/octet/.test(contentType) || !contentType) {
                contentType = await getFileMimeType(buffer);
            }

            if (/application/.test(contentType)) {
                const mimeType = await getMimeTypeFromExtension(finalFileName);
                if (mimeType) {
                    contentType = mimeType;
                }
            }

            if (saveToFile && finalFileName && finalFileName.split('.').length > 1) {
                writeFileSync(finalFileName, buffer, () => {
                    downloadedFiles.add(finalFileName);
                });
            }

            if (setError) {
                process.env['APP_TLS_REJECT_UNAUTHORIZED'] = '1';
            }

            return {
                type: contentType?.split('/')[0],
                size: contentLength,
                name: finalFileName,
                buffer: buffer,
                mimetype: contentType,
                data: false
            };
        } catch (error) {
            if (error.message.includes('unable to verify')) {
                if (!setError) {
                    process.env['APP_TLS_REJECT_UNAUTHORIZED'] = '0';
                    return await fetchFile(url, saveToFile, true);
                }
            }
            if (!isRetry && (url.includes('cdninstagram') || url.includes('fbcdn'))) {
                url = 'https://scontent.cdninstagram.com' + error.request.options.path;
                return await fetchFile(url, saveToFile, false, true);
            }
            return {
                error: `Status: ${error?.response?.status || error}\nReason: ${error?.response?.statusText || error.message}\nURL: ${url}`
            };
        }
    };

    exports.getBuffer = fetchFile;

    exports.getJson = async (url) => {
        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'json',
                timeout: 32000,
                rejectUnauthorized: false
            });
            return response.data;
        } catch (error) {
            throw new Error(error);
        }
    };

    exports.download = async (url, fileName) => {
        const result = {
            error: true,
            ext: '',
            type: ''
        };

        if (downloadedFiles.has(url)) {
            return result;
        }

        const { buffer, name, type } = await fetchFile(url);
        if (!buffer || (type !== 'video' && type !== 'image')) {
            downloadedFiles.add(url);
            console.log(`Downloading ${url} Failed`);
            return result;
        }

        const filePath = `${fileName}.${name.split('.').pop()}`;
        writeFileSync(filePath, buffer);

        return {
            ext: name.split('.').pop(),
            type: type,
            error: false
        };
    };
}