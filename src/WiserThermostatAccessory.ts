import {
  Service,
  CharacteristicValue,
  CharacteristicSetCallback,
  CharacteristicGetCallback,
} from 'homebridge';

import { Room } from '@string-bean/drayton-wiser-client';
import { HAP } from 'homebridge/lib/api';
import { Logger } from 'homebridge';

export class WiserThermostatAccessory {
  // TODO battery level
  constructor(
    public readonly service: Service,
    public room: Room,
    public readonly hap: HAP,
    public readonly log: Logger,
  ) {
    const Characteristic = hap.Characteristic;

    this.service
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .on('get', this.getCurrentState.bind(this))
      .setProps({ validValues: [0, 1, 3] });

    this.service
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on('get', this.getTargetState.bind(this))
      .on('set', this.setTargetState.bind(this))
      .setProps({ validValues: [0, 1, 3] });

    this.service
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', this.getCurrentTemperature.bind(this));

    this.service
      .getCharacteristic(Characteristic.TargetTemperature)
      .on('get', this.getTargetTemperature.bind(this))
      .on('set', this.setTargetTemperature.bind(this))
      .setProps({
        minValue: 5,
        minStep: 0.5,
        maxValue: 30,
      });

    this.service
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .on('get', this.getDisplayUnits.bind(this))
      .on('set', this.setDisplayUnits.bind(this));
  }

  update(room: Room): void {
    this.room = room;
  }

  getCurrentState(callback: CharacteristicGetCallback): void {
    // OFF  = 0
    // HEAT = 1
    // COOL = 2
    // AUTO = 3

    callback(null, 3);
  }

  getTargetState(callback: CharacteristicGetCallback): void {
    callback(null, 3);
  }

  setTargetState(
    value: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ): void {
    this.log.warn('TODO set state');

    callback(null);
  }

  getCurrentTemperature(callback: CharacteristicGetCallback): void {
    callback(null, this.room.temperature);
  }

  getTargetTemperature(callback: CharacteristicGetCallback): void {
    callback(null, this.room.setTemperature);
  }

  setTargetTemperature(
    value: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ): void {
    // TODO update wiser system
    callback(null);
  }

  getDisplayUnits(callback: CharacteristicGetCallback): void {
    callback(null, 0);
  }

  setDisplayUnits(
    value: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ): void {
    callback(null);
  }
}
