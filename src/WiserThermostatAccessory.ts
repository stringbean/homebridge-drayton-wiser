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
      getter: () => {
        if (this.room.active) {
          return Characteristic.CurrentHeatingCoolingState.HEAT;
        } else {
          return Characteristic.CurrentHeatingCoolingState.OFF;
        }
      },
      props: {
        validValues: [
          Characteristic.CurrentHeatingCoolingState.HEAT,
          Characteristic.CurrentHeatingCoolingState.OFF,
        ],
      },
    });

    this.registerCharacteristic({
      type: Characteristic.TargetHeatingCoolingState,
      getter: () => {
        return this.currentTargetState();
      },
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
    // TODO push updates
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
      this.room = updated;

      // let HAP know that the set temperature will have changed
      this.service.updateCharacteristic(
        this.hap.Characteristic.TargetTemperature,
        updated.setTemperature ? updated.setTemperature : 0,
      );
    });
  }

  private currentTargetState(): CharacteristicValue | undefined {
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

  private setTargetTemperature(value: CharacteristicValue): Promise<void> {
    if (this.room.isValid) {
      return this.client
        .overrideRoomSetPoint(this.room.id, <number>value)
        .then((updated) => {
          this.room = updated;

          // let HAP know that the state will have changed
          this.service.updateCharacteristic(
            this.hap.Characteristic.TargetHeatingCoolingState,
            this.hap.Characteristic.TargetHeatingCoolingState.HEAT,
          );
        });
    } else {
      return Promise.resolve();
    }
  }
}
