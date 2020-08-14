'use strict';

const WiserPlatformPlugin = require('./src/WiserPlatformPlugin');

module.exports = function(homebridge) {
    homebridge.registerPlatform('homebridge-drayton-wiser', 'drayton-wiser', WiserPlatformPlugin, true)
}