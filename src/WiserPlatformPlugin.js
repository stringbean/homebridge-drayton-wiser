const WiserThermostatAccessory = require('./WiserThermostatAccessory');
const WiserApi = require('./WiserApi');
const timer = require("rxjs").timer;

class WiserPlatformPlugin {
    accessories = [];
    thermostats = [];

    constructor(log, config, api) {
        log.info("Loading Wiser platform")
        this.api = api;
        this.log = log;

        this.wiserApi = new WiserApi(config.ip, config.secret);

        api.on('didFinishLaunching', () => {
            this.updateInterval = timer(0, 5000);

            this.updateInterval.subscribe(() => {
                this.log.debug('Polling system');
                this._updateSystem();
            })
        })
    }

    configureAccessory(accessory) {
        this.accessories[accessory.UUID] = accessory;
        // TODO find/update thermostat
    }

    _getOrCreateService(accessory, serviceType) {
        const service = accessory.getService(serviceType);

        if (service) {
            return service;
        }

        return accessory.addService(serviceType);
    }

    _updateSystem() {
        this.wiserApi.listRooms()
            .then((rooms) => {
                this.log.debug('Finished querying rooms');
                this.updateRooms(rooms);
            })
    }

    createThermostat(room) {
        const uuid = this.api.hap.uuid.generate(`drayton-wiser:1:${room.id}`);

        if (this.accessories[uuid]) {
            // update the room
            if (!this.thermostats[uuid]) {
                const accessory = this.accessories[uuid];
                const service = this._getOrCreateService(accessory, this.api.hap.Service.Thermostat);
                this.thermostats[uuid] = new WiserThermostatAccessory(service, room, this.api.hap, this.log);
            }

            const thermostat = this.thermostats[uuid];

            thermostat.update(room);
            return [this.accessories[uuid], false];
        } else {
            const accessory = new this.api.platformAccessory(room.name, uuid);

            const service = this._getOrCreateService(accessory, this.api.hap.Service.Thermostat);

            const infoService = this._getOrCreateService(accessory, this.api.hap.Service.AccessoryInformation);
            infoService.getCharacteristic(this.api.hap.Characteristic.Manufacturer)
                .on('get', (callback) => callback('Drayton'));

            this.thermostats[uuid] = new WiserThermostatAccessory(service, room, this.api.hap, this.log);
            this.accessories[uuid] = accessory;
            return [accessory, true];
        }
    }

    updateRooms(rooms) {
        const currentAccessories = rooms.map((room) => this.createThermostat(room));
        const staleIds = this.accessories.filter((id) => !currentAccessories.find(a => a[0].UUID === id));

        if (staleIds.length) {
            this.log(`Removing ${staleIds.length} stale accessories`);
            this.api.unregisterPlatformAccessories(
                'homebridge-drayton-wiser',
                'drayton-wiser',
                staleIds
            )
        }

        const newAccessories = currentAccessories.filter(a => a[1]).map(a => a[0]);

        if (newAccessories.length) {
            this.log.info(`Found ${newAccessories.length} new accessories`);
        }

        if (newAccessories.length) {
            this.api.registerPlatformAccessories('homebridge-drayton-wiser', 'drayton-wiser', newAccessories);
        }
    }
}

module.exports = function (log, config, api) {
    return new WiserPlatformPlugin(log, config, api)
}