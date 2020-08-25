const WiserThermostatAccessory = require('./WiserThermostatAccessory');
const timer = require("rxjs").timer;

const wiserClient = require('@string-bean/drayton-wiser-client');

class WiserPlatformPlugin {
    accessories = [];
    thermostats = [];

    constructor(log, config, api) {
        log.info("Loading Wiser platform")

        console.log('client?', wiserClient);

        this.api = api;
        this.log = log;

        this.wiserClient = new wiserClient.WiserClient(config.secret, config.ip);

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
    }

    _getOrCreateService(accessory, serviceType) {
        const service = accessory.getService(serviceType);

        if (service) {
            return service;
        }

        return accessory.addService(serviceType);
    }

    _updateSystem() {
        this.wiserClient.roomStatuses()
            .then((rooms) => {
                this.log.debug('Finished querying rooms');
                this.updateRooms(rooms);
            })
    }

    createThermostat(room) {
        const uuid = this.api.hap.uuid.generate(`drayton-wiser:1:${room.id}`);

        console.log(`configuring thermostat ${room.id} (${uuid}`);

        let newAccessory = false;

        if (!this.accessories[uuid]) {
            this.accessories[uuid] = new this.api.platformAccessory(room.name, uuid);
            newAccessory = true
        }

        const accessory = this.accessories[uuid];
        this._updateAccessoryInformation(accessory, room);

        if (!this.thermostats[uuid]) {
            const service = this._getOrCreateService(accessory, this.api.hap.Service.Thermostat);
            this.thermostats[uuid] = new WiserThermostatAccessory(service, room, this.api.hap, this.log);
        }

        const thermostat = this.thermostats[uuid];
        thermostat.update(room);

        return [accessory, newAccessory];
    }
    
    _updateAccessoryInformation(accessory, room) {
        this._getOrCreateService(accessory, this.api.hap.Service.AccessoryInformation)
            .setCharacteristic(this.api.hap.Characteristic.Manufacturer, 'Drayton')
            .setCharacteristic(this.api.hap.Characteristic.Model, 'iTRV');
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