class WiserThermostatAccessory {
    // TODO battery
    constructor(service, room, hap, log) {
        this.service = service;
        this.room = room;
        this.log = log

        const Characteristic = hap.Characteristic;

        // this.service.registerCharacteristic({
        //     characteristicType: Characteristic.Manufacturer,
        //     serviceType: hap.Service.AccessoryInformation,
        //     getValue: (data) => 'Drayton'
        // })

        // this.service.setCharacteristic(Characteristic.Manufacturer, 'Drayton');


        this.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .on('get', this.getCurrentState.bind(this))
            .setProps({validValues: [0, 1, 3]});

        this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .on('get', this.getTargetState.bind(this))
            .on('set', this.setTargetState.bind(this))
            .setProps({validValues: [0, 1, 3]});

        this.service.getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getCurrentTemperature.bind(this));

        this.service.getCharacteristic(Characteristic.TargetTemperature)
            .on('get', this.getTargetTemperature.bind(this))
            .on('set', this.setTargetTemperature.bind(this))
            .setProps({
                minValue: 5,
                minStep: 0.5,
                maxValue: 30
            });

        this.service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on('get', this.getDisplayUnits.bind(this))
            .on('set', this.setDisplayUnits.bind(this));

    }

    update(room) {
        this.room = room;
    }

    getCurrentState(callback) {
//      // OFF  = 0
//         // HEAT = 1
//         // COOL = 2
//         // AUTO = 3

        callback(null, 3);
    }

    getTargetState(callback) {
        callback(null, 3);
    }

    setTargetState(targetState, callback) {
        this.log.warn('TODO set state');

        callback(null);
    }

    getCurrentTemperature(callback) {
        callback(null, this.room.currentTemperature / 10);
    }

    getTargetTemperature(callback) {
        callback(null, this.room.setPoint / 10);

    }

    setTargetTemperature(targetTemperature, callback) {
        // this.targetTemp = targetTemperature;
        this.room.setPoint = targetTemperature * 10;
        callback(null);
    }

    getDisplayUnits(callback) {
        callback(null, 1);
    }

    setDisplayUnits(units, callback) {
        callback(null);
    }


}


module.exports = function (service, room, hap, log) {
    return new WiserThermostatAccessory(service, room, hap, log)
}