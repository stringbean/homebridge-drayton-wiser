import {
  Characteristic,
  CharacteristicGetCallback,
  CharacteristicProps,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logger,
  PlatformAccessory,
  Service,
  WithUUID,
} from 'homebridge';
import { WiserClient } from '@string-bean/drayton-wiser-client';

export type CharacteristicType = WithUUID<{ new (): Characteristic }>;
export type ServiceType = WithUUID<typeof Service>;

export abstract class BaseAccessory {
  protected constructor(
    protected readonly accessory: PlatformAccessory,
    protected readonly hap: HAP,
    protected readonly log: Logger,
    protected readonly client: WiserClient,
  ) {}

  protected getService(serviceType: ServiceType): Service {
    const service = this.accessory.getService(serviceType);

    if (service) {
      return service;
    }

    // service subclasses have optional constructor args, unlike the base Service
    const ServiceClass = <new () => Service>(<unknown>serviceType);
    return this.accessory.addService(new ServiceClass());
  }

  protected registerCharacteristic({
    serviceType,
    characteristicType,
    getter,
    setter,
    props,
  }: {
    serviceType: ServiceType;
    characteristicType: CharacteristicType;
    getter?: () => CharacteristicValue | undefined;
    setter?: (value: CharacteristicValue) => Promise<void>;
    props?: Partial<CharacteristicProps>;
  }): void {
    const service = this.getService(serviceType);
    const characteristic = service.getCharacteristic(characteristicType);

    if (getter) {
      characteristic.on('get', (callback: CharacteristicGetCallback) => {
        try {
          callback(null, getter());
        } catch (error) {
          callback(<Error>error);
        }
      });
    }

    if (setter) {
      characteristic.on(
        'set',
        (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          setter(value)
            .then(() => {
              callback();
            })
            .catch((error) => {
              callback(error);
            });
        },
      );
    }

    if (props) {
      characteristic.setProps(props);
    }
  }

  protected updateCharacteristic({
    serviceType,
    characteristicType,
    value,
  }: {
    serviceType: ServiceType;
    characteristicType: CharacteristicType;
    value: CharacteristicValue;
  }): void {
    this.getService(serviceType).updateCharacteristic(
      characteristicType,
      value,
    );
  }
}
