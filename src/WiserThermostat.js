class WiserThermostat {
    constructor(json) {
        this.id = json.id;
        this.name = json.Name;
        this.setPoint = json.CurrentSetPoint;
        this.currentTemperature = json.CalculatedTemperature;
        this.valid = !json.Invalid;
    }
}

module.exports = function (json) {
    return new WiserThermostat(json);
}