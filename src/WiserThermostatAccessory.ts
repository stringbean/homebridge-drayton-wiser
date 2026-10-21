import { BaseAccessory, CharacteristicType } from './BaseAccessory';
import {
  CharacteristicValue,
  HAP,
  Logger,
  PlatformAccessory,
} from 'homebridge';
import {
  Device,
  Room,
  RoomMode,
  WiserClient,
} from '@string-bean/drayton-wiser-client';
import { BatteryLevel } from '@string-bean/drayton-wiser-client/dist/api/BatteryLevel';
import { boostRoom, BoostOptions } from './RoomBoost';

const MIN_SET_POINT = 5;
const MAX_SET_POINT = 30;
// used when switching a room from off to heat, as wiser has no set point for it
const DEFAULT_HEAT_SET_POINT = 20;

export class WiserThermostatAccessory extends BaseAccessory {
  private boosted = false;
  // boosts started from homekit, in case the hub reports them as manual
  private boostSetPoint?: number;
  private boostUntil?: number;

  constructor(
    accessory: PlatformAccessory,
    hap: HAP,
    log: Logger,
    client: WiserClient,
    private room: Room,
    private device?: Device,
    private boost?: BoostOptions,
  ) {
    super(accessory, hap, log, client);
    const Characteristic = hap.Characteristic;

    this.getService(hap.Service.Thermostat).setPrimaryService(true);

    const existingBoostSwitch = accessory.getService(hap.Service.Switch);

    if (boost) {
      if (!existingBoostSwitch) {
        this.addBoostSwitch(`${room.name} Boost`);
      }

      this.boosted = this.isBoosted(room);

      this.registerCharacteristic({
        serviceType: hap.Service.Switch,
        characteristicType: Characteristic.On,
        getter: () => this.boosted,
        setter: this.setBoost.bind(this),
      });
    } else if (existingBoostSwitch) {
      accessory.removeService(existingBoostSwitch);
    }

    this.registerCharacteristic({
      serviceType: hap.Service.Thermostat,
      characteristicType: Characteristic.CurrentHeatingCoolingState,
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
      serviceType: hap.Service.Thermostat,
      characteristicType: Characteristic.TargetHeatingCoolingState,
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
      serviceType: hap.Service.Thermostat,
      characteristicType: Characteristic.CurrentTemperature,
      getter: () => {
        return this.room.temperature;
      },
    });

    this.registerCharacteristic({
      serviceType: hap.Service.Thermostat,
      characteristicType: Characteristic.TargetTemperature,
      getter: () => {
        return this.room.setTemperature ?? MIN_SET_POINT;
      },
      setter: this.setTargetTemperature.bind(this),
      props: {
        minValue: MIN_SET_POINT,
        minStep: 0.5,
        maxValue: MAX_SET_POINT,
      },
    });

    this.registerCharacteristic({
      serviceType: hap.Service.Thermostat,
      characteristicType: Characteristic.TemperatureDisplayUnits,
      getter: () => Characteristic.TemperatureDisplayUnits.CELSIUS,
      setter: () => Promise.resolve(),
    });

    if (device) {
      this.registerCharacteristic({
        serviceType: hap.Service.BatteryService,
        characteristicType: Characteristic.BatteryLevel,
        getter: () => {
          if (this.device) {
            return WiserThermostatAccessory.batteryLevel(this.device);
          } else {
            return 0;
          }
        },
      });

      this.registerCharacteristic({
        serviceType: hap.Service.BatteryService,
        characteristicType: Characteristic.StatusLowBattery,
        getter: () => this.device?.batteryLevel === BatteryLevel.Low,
      });
    }
  }

  update(room: Room, device?: Device): void {
    if (this.room.temperature !== room.temperature) {
      this.updateCharacteristic({
        serviceType: this.hap.Service.Thermostat,
        characteristicType: this.hap.Characteristic.CurrentTemperature,
        value: room.temperature ? room.temperature : 0,
      });
    }

    if (this.room.setTemperature !== room.setTemperature) {
      this.updateCharacteristic({
        serviceType: this.hap.Service.Thermostat,
        characteristicType: this.hap.Characteristic.TargetTemperature,
        value: room.setTemperature ?? MIN_SET_POINT,
      });
    }

    if (this.room.active !== room.active) {
      this.updateCharacteristic({
        serviceType: this.hap.Service.Thermostat,
        characteristicType: this.hap.Characteristic.CurrentHeatingCoolingState,
        value: WiserThermostatAccessory.roomCurrentState(room, this.hap),
      });
    }

    if (this.room.mode !== room.mode) {
      this.updateCharacteristic({
        serviceType: this.hap.Service.Thermostat,
        characteristicType: this.hap.Characteristic.TargetHeatingCoolingState,
        value: WiserThermostatAccessory.roomTargetState(room, this.hap),
      });
    }

    const boosted = this.isBoosted(room);

    if (this.boost && this.boosted !== boosted) {
      this.updateCharacteristic({
        serviceType: this.hap.Service.Switch,
        characteristicType: this.hap.Characteristic.On,
        value: boosted,
      });
      this.boosted = boosted;
    }

    this.room = room;

    if (device) {
      if (this.device?.batteryLevel !== device.batteryLevel) {
        this.updateCharacteristic({
          serviceType: this.hap.Service.BatteryService,
          characteristicType: this.hap.Characteristic.BatteryLevel,
          value: WiserThermostatAccessory.batteryLevel(device) ?? 0,
        });

        this.updateCharacteristic({
          serviceType: this.hap.Service.BatteryService,
          characteristicType: this.hap.Characteristic.StatusLowBattery,
          value: device.batteryLevel === BatteryLevel.Low,
        });
      }

      this.device = device;
    }
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
          this.room.setTemperature ?? DEFAULT_HEAT_SET_POINT,
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

  private setBoost(value: CharacteristicValue): Promise<void> {
    if (!this.boost) {
      return Promise.resolve();
    }

    let postUpdate: Promise<Room>;

    if (value === true) {
      const { durationMinutes, temperatureIncrease } = this.boost;
      // boost above whichever is higher, so a room that is still warming up
      // gets more heat rather than less
      const base = Math.max(
        this.room.temperature ?? 0,
        this.room.setTemperature ?? 0,
      );
      const boosted = (base || DEFAULT_HEAT_SET_POINT) + temperatureIncrease;
      const setPoint = Math.min(MAX_SET_POINT, Math.round(boosted * 2) / 2);

      this.boostSetPoint = setPoint;
      this.boostUntil = Date.now() + durationMinutes * 60 * 1000;
      this.log.info(
        `Boosting ${this.room.name} to ${setPoint}°C for ${durationMinutes} minutes`,
      );

      postUpdate = boostRoom(
        this.client,
        this.room.id,
        setPoint,
        durationMinutes,
      );
    } else {
      this.boostUntil = undefined;
      postUpdate = this.client.cancelRoomOverride(this.room.id);
    }

    return postUpdate.then((updated) => {
      this.update(updated);
    });
  }

  private isBoosted(room: Room): boolean {
    if (room.mode === RoomMode.Boost) {
      return true;
    }

    return (
      room.mode === RoomMode.Manual &&
      this.boostUntil !== undefined &&
      Date.now() < this.boostUntil &&
      room.setTemperature === this.boostSetPoint
    );
  }

  private addBoostSwitch(name: string): void {
    const service = this.accessory.addService(this.hap.Service.Switch, name);

    // iOS 16+ needs ConfiguredName to show the name, but older HAP versions
    // don't have it
    const ConfiguredName = (<Record<string, CharacteristicType | undefined>>(
      (<unknown>this.hap.Characteristic)
    )).ConfiguredName;

    if (ConfiguredName) {
      service.addOptionalCharacteristic(ConfiguredName);
      service.setCharacteristic(ConfiguredName, name);
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

  private static batteryLevel(
    device?: Device,
  ): CharacteristicValue | undefined {
    switch (device?.batteryLevel) {
      case BatteryLevel.Normal:
        return 100;

      case BatteryLevel.TwoThirds:
        return 66;

      case BatteryLevel.OneThird:
        return 33;

      case BatteryLevel.Low:
        return 10;

      default:
        return undefined;
    }
  }
}
