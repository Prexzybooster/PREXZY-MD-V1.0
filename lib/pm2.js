const pm2 = require('pm2');

exports.stopInstance = (instanceId, callback) => {
    console.log('pm2 stopping instance', instanceId);
    pm2.stop(instanceId || process.env.pm_id || 'myInstance', (err) => {
        if (err) {
            console.error(err);
            process.exit(0);
        }
    });
};

exports.restartInstance = (instanceId, callback) => {
    console.log('pm2 restarting instance', instanceId);
    pm2.restart(instanceId || process.env.pm_id || 'myInstance', (err) => {
        if (err) {
            console.error(err);
            process.exit(0);
        }
    });
};