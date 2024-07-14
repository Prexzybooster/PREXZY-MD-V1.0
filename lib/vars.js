const config = require('../config');
const HEROKU_API_KEY = config.HEROKU_API_KEY;
const KOYEB_API = config.KOYEB_API;
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const dotenv = require('dotenv');
const Heroku = require('heroku-client');
const pm2 = require('./pm2');

const heroku = new Heroku({ token: HEROKU_API_KEY });

const updateConfigVars = (vars, config) => {
    const [key] = Object.keys(vars);
    config.env = config.env.map(item => {
        if (item.key === key) {
            item.value = vars[key];
        }
        return item;
    });
    return config;
};

const headers = {
    'content-type': 'application/json',
    'authorization': `Bearer ${KOYEB_API}`
};

const platforms = {
    'koyeb': {
        'headers': headers,
        'getVars': async () => {
            const { data } = await axios.get('https://app.koyeb.com/v1/services', { headers });
            const service = data.services.find(s => s.name === config.KOYEB_NAME) || data.services[0];
            if (!service) throw new Error(`koyeb: app ${config.KOYEB_NAME} not found`);
            return { id: service.id, did: service.active_deployment_id, scopes: service.scopes };
        },
        'setVar': async (vars) => {
            const { id, did } = await platforms.koyeb.getVars();
            const { data } = await axios.get(`https://app.koyeb.com/v1/deployments/${did}`, { headers });
            const updatedConfig = updateConfigVars(vars, data.deployment.definition);
            await axios.patch(`https://app.koyeb.com/v1/services/${id}`, { definition: updatedConfig }, { headers });
        },
        'delVar': async (key) => {
            const config = await platforms.koyeb.getVars();
            delete config.env[key];
            const updatedConfig = updateConfigVars(config.env, config.def);
            await axios.patch(`https://app.koyeb.com/v1/services/${config.id}`, { definition: updatedConfig }, { headers });
        }
    },
    'heroku': {
        'base': `/apps/${config.HEROKU_APP_NAME}/config-vars`,
        'setVar': async (vars) => {
            try {
                await heroku.patch(platforms.heroku.base, { body: vars });
            } catch (error) {
                throw new Error(`HEROKU: ${error.message}`);
            }
        },
        'getVars': async () => {
            try {
                return await heroku.get(platforms.heroku.base);
            } catch (error) {
                throw new Error(`HEROKU: ${error.message}`);
            }
        },
        'delVar': async (key) => {
            try {
                const vars = await platforms.heroku.getVars();
                if (vars[key.trim().toUpperCase()]) {
                    await heroku.patch(platforms.heroku.base, { body: { [key.trim().toUpperCase()]: null } });
                }
            } catch (error) {
                throw new Error(`HEROKU: ${error.message}`);
            }
        }
    },
    'vps': {
        'getVars': async () => {
            if (!fs.existsSync(path.join(__dirname, '../config.env'))) {
                fs.writeFileSync(path.join(__dirname, '../config.env'), '{}');
                return {};
            }
            return dotenv.parse(fs.readFileSync(path.join(__dirname, '../config.env')));
        },
        'setVar': async (vars) => {
            const config = await platforms.vps.getVars();
            Object.assign(config, vars);
            let content = '';
            for (const key in config) {
                content += `${key} = "${config[key]}"\n`;
            }
            fs.writeFileSync(path.join(__dirname, '../config.env'), content.trim());
            setTimeout(() => {
                pm2.restartInstance(process.env.pm_id);
            }, 3000);
        },
        'delVar': async (key) => {
            const config = await platforms.vps.getVars();
            if (config[key]) {
                delete config[key];
                let content = '';
                for (const k in config) {
                    content += `${k} = "${config[k]}"\n`;
                }
                fs.writeFileSync(path.join(__dirname, '../config.env'), content.trim());
                setTimeout(() => {
                    pm2.restartInstance(process.env.pm_id);
                }, 3000);
            }
        }
    },
    'false': {
        'setVar': () => {
            throw new Error('Failed to detect the Platform, Please enter Heroku or Koyeb or VPS config respectively');
        },
        'delVar': () => {
            throw new Error('Failed to detect the Platform, Please enter Heroku or Koyeb or VPS config respectively');
        },
        'getVars': () => {
            throw new Error('Failed to detect the Platform, Please enter Heroku or Koyeb or VPS config respectively');
        }
    }
};

const platform = HEROKU_API_KEY && config.HEROKU_APP_NAME ? 'heroku' : KOYEB_API && config.KOYEB_NAME ? 'koyeb' : config.VPS ? 'vps' : 'false';

exports.upKoyeb = async () => {
    const config = await platforms.koyeb.getVars();
    await axios.patch(`https://app.koyeb.com/v1/services/${config.id}`, { definition: config.def }, { headers });
};

exports.setVar = platforms[platform].setVar;
exports.getVars = platforms[platform].getVars;
exports.delVar = platforms[platform].delVar;