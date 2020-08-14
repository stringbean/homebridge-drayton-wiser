const fetch = require('node-fetch');
const WiserThermostat = require('./WiserThermostat');

class WiserApi {
    constructor(ip, secret) {
        this.ip = ip;
        this.secret = secret;
    }

    listRooms() {
        const headers = {
            SECRET: this.secret
        }

        // TODO include channel ids?
        return fetch(`http://${this.ip}/data/domain/`, {headers})
            .then((response) => {
                if (!response.ok) {
                    console.log('not ok dammit', response);
                }
                return response.json();
            })
            .then((json) => {
                return json.Room
                    .map((roomJson) => new WiserThermostat(roomJson))
                    .filter((room) => room.valid);
            })
    }
}

module.exports = function (ip, secret) {
    return new WiserApi(ip, secret);
}