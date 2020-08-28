import {
  Characteristic,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  Logger,
  Service,
  WithUUID,
} from 'homebridge';
import { WiserClient } from '@string-bean/drayton-wiser-client';
import { HAP } from 'homebridge/lib/api';
import { CharacteristicProps } from 'hap-nodejs/dist/lib/Characteristic';

export type CharacteristicType = WithUUID<{ new (): Characteristic }>;

export abstract class BaseAccessory {
  protected constructor(
    protected readonly service: Service,
    protected readonly hap: HAP,
    protected readonly log: Logger,
    protected readonly client: WiserClient,
  ) {}

  protected registerCharacteristic({
    type,
    getter,
    setter,
    props,
  }: {
    type: CharacteristicType;
    getter?: () => CharacteristicValue | undefined;
    setter?: (value: CharacteristicValue) => Promise<void>;
    props?: Partial<CharacteristicProps>;
  }): void {
    const characteristic = this.service.getCharacteristic(type);

    if (getter) {
      characteristic.on('get', (callback: CharacteristicGetCallback) => {
        try {
          callback(null, getter());
        } catch (error) {
          callback(error);
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
}
