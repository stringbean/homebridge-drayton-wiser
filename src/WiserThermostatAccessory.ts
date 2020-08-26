import {
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  Logger,
  Service,
} from 'homebridge';

import { Room, RoomMode, WiserClient } from '@string-bean/drayton-wiser-client';
import { HAP } from 'homebridge/lib/api';

export class WiserThermostatAccessory {
  // TODO battery level
  constructor(
    private readonly service: Service,
    private room: Room,
    private readonly hap: HAP,
    private readonly log: Logger,
    private readonly client: WiserClient,
  ) {
    const Characteristic = hap.Characteristic;

    this.service
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .on('get', this.getCurrentState.bind(this))
      .setProps({
        validValues: [
          this.hap.Characteristic.CurrentHeatingCoolingState.HEAT,
          this.hap.Characteristic.CurrentHeatingCoolingState.OFF,
        ],
      });

    this.service
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on('get', this.getTargetState.bind(this))
      .on('set', this.setTargetState.bind(this))
      .setProps({
        validValues: [
          this.hap.Characteristic.TargetHeatingCoolingState.OFF,
          this.hap.Characteristic.TargetHeatingCoolingState.HEAT,
          this.hap.Characteristic.TargetHeatingCoolingState.AUTO,
        ],
      });

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
    if (this.room.active) {
      callback(null, this.hap.Characteristic.CurrentHeatingCoolingState.HEAT);
    } else {
      callback(null, this.hap.Characteristic.CurrentHeatingCoolingState.OFF);
    }
  }

  getTargetState(callback: CharacteristicGetCallback): void {
    callback(null, this.currentTargetState());
  }

  private currentTargetState(): number | undefined {
    if (this.room.isValid) {
      switch (this.room.mode) {
        case RoomMode.Off:
          return this.hap.Characteristic.TargetHeatingCoolingState.OFF;

        case RoomMode.Manual:
        case RoomMode.Boost:
          return this.hap.Characteristic.TargetHeatingCoolingState.HEAT;

        default:
          return this.hap.Characteristic.TargetHeatingCoolingState.AUTO;
      }
    }

    return undefined;
  }

  setTargetState(
    value: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ): void {
    let postUpdate: Promise<Room>;

    switch (value) {
      case this.hap.Characteristic.TargetHeatingCoolingState.OFF:
        postUpdate = this.client.disableRoom(this.room.id);
        break;

      case this.hap.Characteristic.TargetHeatingCoolingState.HEAT:
        postUpdate = this.client.overrideRoomSetPoint(
          this.room.id,
          this.room.setTemperature!,
        );
        break;

      case this.hap.Characteristic.TargetHeatingCoolingState.AUTO:
      default:
        postUpdate = this.client.cancelRoomOverride(this.room.id);
    }

    postUpdate.then((updated) => {
      this.room = updated;

      // let HAP know that the set temperature will have changed
      this.service.updateCharacteristic(
        this.hap.Characteristic.TargetTemperature,
        updated.setTemperature ? updated.setTemperature : 0,
      );

      callback(null, this.currentTargetState());
    });
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
    if (this.room.isValid) {
      this.client.overrideRoomSetPoint(this.room.id, <number>value).then(
        (updated) => {
          this.room = updated;

          // let HAP know that the state will have changed
          this.service.updateCharacteristic(
            this.hap.Characteristic.TargetHeatingCoolingState,
            this.hap.Characteristic.TargetHeatingCoolingState.HEAT,
          );

          callback(null, this.room.setTemperature);
        },
        (error) => {
          callback(error);
        },
      );
    } else {
      callback(null);
    }
  }

  getDisplayUnits(callback: CharacteristicGetCallback): void {
    callback(null, this.hap.Characteristic.TemperatureDisplayUnits.CELSIUS);
  }

  setDisplayUnits(
    value: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ): void {
    callback(null);
  }
}
