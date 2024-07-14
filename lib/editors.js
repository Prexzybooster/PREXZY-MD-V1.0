const importNodeFetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const formData = require('form-data');
const crypto = require('crypto');

const base64EncodedString = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const { iChecker } = require('./test/test');
const checkString = iChecker();
const isValid = checkString === base64EncodedString;

if (isValid) {
    const { getUrl } = require('./utils');
    const createMakeupXML = (url) => `
        <image_process_call>
            <image_url>${url}</image_url>
            <methods_list>
                <method>
                    <name>makeup</name>
                    <params>
                        use_skin_healing=true;use_eyes_enhancement=true;use_teeth_whitening=true;
                        use_portrait_filters=true;use_flash_healing=true;use_wrinkles_healing=true;
                        use_auto_red_eye=false;use_skin_color_corrector=true
                    </params>
                </method>
            </methods_list>
            <lang>en</lang>
        </image_process_call>`;

    const createCollageXML = (url, template, variant = 0) => `
        <image_process_call>
            <image_url order="1">${url}</image_url>
            <methods_list>
                <method order="1">
                    <name>collage</name>
                    <params>template_name=${template}; template_variant=${variant}</params>
                </method>
            </methods_list>
            <result_size>1400</result_size>
            <result_quality>100</result_quality>
            <template_watermark>false</template_watermark>
            <lang>en</lang>
            <abort_methods_chain_on_error>true</abort_methods_chain_on_error>
        </image_process_call>`;

    const createSignature = (data, secret = '2AC9CD8593D6ED7940C829E19DC3') => {
        const hmac = crypto.createHmac('sha1', secret);
        return hmac.update(Buffer.from(data, 'utf-8')).digest('hex');
    };

    const effects = {
        demon: 'demon_eyes_effect',
        bloody: 'halloween_mask',
        zombie: 'zombie',
        horned: 'horned_goblin',
        sketch: 'sketch',
        skull: 'skull_makeup',
        pencil: 'graphite_pencil_sketch',
        color: 'color_pencil_sketch',
        kiss: 'kisses_on_face_photo_effect',
        bokeh: 'christmas_bokeh',
        wanted: 'wanted',
        look: 'dramatic_look',
        gandm: 'hipster_glasses_and_mustache',
        dark: 'the_dark_knight'
    };

    const createCaricatureXML = (url) => `
        <image_process_call>
            <image_url>${url}</image_url>
            <methods_list>
                <method>
                    <name>caricature</name>
                    <params>cartoon=true</params>
                </method>
            </methods_list>
        </image_process_call>`;

    const processImage = async (imageUrl, effect) => {
        let requestData;
        switch (effect) {
            case 'makeup':
                requestData = createMakeupXML(imageUrl);
                break;
            case 'cartoon':
                requestData = createCaricatureXML(imageUrl);
                break;
            default:
                requestData = createCollageXML(imageUrl, effect);
                break;
        }

        const form = new formData();
        form.append('app_id', '8BDD0A61779556B1F9F817CCA583');
        form.append('data', requestData);
        const signature = createSignature(requestData);
        form.append('sign_data', signature);

        const response = await importNodeFetch('https://opeapi.ws.pho.to/get-result.php?service_id=7', {
            method: 'POST',
            headers: {
                'Accept': '/',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'GoogleBot',
                ...form.getHeaders()
            },
            body: form.getBuffer()
        });

        const responseBody = await response.text();
        const statusCheck = async () => {
            const statusResponse = await importNodeFetch(`https://opeapi.ws.pho.to/get-result.php?request_id=${responseBody.match(/<request_id>(.*)<\/request_id>/)[1]}`);
            const statusText = await statusResponse.text();
            const status = statusText.match(/<status>(.*)<\/status>/)[1];

            if (status === 'InProgress') {
                return await statusCheck();
            }

            return {
                status: status === 'OK',
                result: status === 'OK' ? statusText.match(/<result_url_alt>(.*)<\/result_url_alt>/)[1] : statusText.match(/<description>(.*)<\/description>/)[1]
            };
        };

        return await statusCheck();
    };

    exports.photoEditor = async (imagePath, effect) => {
        const imageUrl = await getUrl(imagePath);
        const selectedEffect = effects[effect] || effect;
        return await processImage(imageUrl, selectedEffect);
    };
}