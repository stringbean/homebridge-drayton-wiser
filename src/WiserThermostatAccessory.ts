import { BaseAccessory } from './BaseAccessory';
import { CharacteristicValue, Logger, Service } from 'homebridge';
import { Room, RoomMode, WiserClient } from '@string-bean/drayton-wiser-client';
import { HAP } from 'homebridge/lib/api';

export class WiserThermostatAccessory extends BaseAccessory {
  constructor(
    service: Service,
    hap: HAP,
    log: Logger,
    client: WiserClient,
    private room: Room,
  ) {
    super(service, hap, log, client);
    const Characteristic = hap.Characteristic;

    this.registerCharacteristic({
      type: Characteristic.CurrentHeatingCoolingState,
      getter: () =>
        WiserThermostatAccessory.roomCurrentState(this.room, this.hap),
      props: {
        validValues: [
          Characteristic.CurrentHeatingCoolingState.HEAT,
          Characteristic.CurrentHeatingCoolingState.OFF,
        ],
      },
    });

    this.registerCharacteristic({
      type: Characteristic.TargetHeatingCoolingState,
      getter: () =>
        WiserThermostatAccessory.roomTargetState(this.room, this.hap),
      setter: this.setTargetState.bind(this),
      props: {
        validValues: [
          Characteristic.TargetHeatingCoolingState.OFF,
          Characteristic.TargetHeatingCoolingState.HEAT,
          Characteristic.TargetHeatingCoolingState.AUTO,
        ],
      },
    });

    this.registerCharacteristic({
      type: Characteristic.CurrentTemperature,
      getter: () => {
        return this.room.temperature;
      },
    });

    this.registerCharacteristic({
      type: Characteristic.TargetTemperature,
      getter: () => {
        return this.room.setTemperature;
      },
      setter: this.setTargetTemperature.bind(this),
      props: {
        minValue: 5,
        minStep: 0.5,
        maxValue: 30,
      },
    });

    this.registerCharacteristic({
      type: Characteristic.TemperatureDisplayUnits,
      getter: () => Characteristic.TemperatureDisplayUnits.CELSIUS,
      setter: () => Promise.resolve(),
    });
  }

  update(room: Room): void {
    if (this.room.temperature !== room.temperature) {
      this.service.updateCharacteristic(
        this.hap.Characteristic.CurrentTemperature,
        room.temperature ? room.temperature : 0,
      );
    }

    if (this.room.setTemperature !== room.setTemperature) {
      this.service.updateCharacteristic(
        this.hap.Characteristic.TargetTemperature,
        room.temperature ? room.temperature : 0,
      );
    }

    if (this.room.active !== room.active) {
      this.service.updateCharacteristic(
        this.hap.Characteristic.CurrentHeatingCoolingState,
        WiserThermostatAccessory.roomCurrentState(room, this.hap),
      );
    }

    if (this.room.mode !== room.mode) {
      this.service.updateCharacteristic(
        this.hap.Characteristic.TargetHeatingCoolingState,
        WiserThermostatAccessory.roomTargetState(room, this.hap),
      );
    }

    this.room = room;
  }

  private setTargetState(value: CharacteristicValue): Promise<void> {
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

    return postUpdate.then((updated) => {
      this.update(updated);
    });
  }

  private setTargetTemperature(value: CharacteristicValue): Promise<void> {
    if (this.room.isValid) {
      return this.client
        .overrideRoomSetPoint(this.room.id, <number>value)
        .then((updated) => {
          this.update(updated);
        });
    } else {
      return Promise.resolve();
    }
  }

  private static roomTargetState(room: Room, hap: HAP): CharacteristicValue {
    switch (room.mode) {
      case RoomMode.Off:
        return hap.Characteristic.TargetHeatingCoolingState.OFF;

      case RoomMode.Manual:
      case RoomMode.Boost:
        return hap.Characteristic.TargetHeatingCoolingState.HEAT;

      default:
        return hap.Characteristic.TargetHeatingCoolingState.AUTO;
    }
  }

  private static roomCurrentState(room: Room, hap: HAP): CharacteristicValue {
    if (room.active) {
      return hap.Characteristic.CurrentHeatingCoolingState.HEAT;
    } else {
      return hap.Characteristic.CurrentHeatingCoolingState.OFF;
    }
  }
}
