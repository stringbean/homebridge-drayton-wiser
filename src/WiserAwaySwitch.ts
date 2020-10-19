import { BaseAccessory } from './BaseAccessory';
import { CharacteristicValue, Logger, PlatformAccessory } from 'homebridge';
import { HAP } from 'homebridge/lib/api';
import { FullStatus, WiserClient } from '@string-bean/drayton-wiser-client';

export class WiserAwaySwitch extends BaseAccessory {
  private away = false;

  constructor(
    accessory: PlatformAccessory,
    hap: HAP,
    log: Logger,
    client: WiserClient,
  ) {
    super(accessory, hap, log, client);
    const Characteristic = hap.Characteristic;

    this.registerCharacteristic({
      serviceType: this.hap.Service.Switch,
      characteristicType: Characteristic.On,
      getter: () => this.away,
      setter: this.setAway.bind(this),
    });
  }

  update(away: boolean): void {
    if (this.away !== away) {
      this.updateCharacteristic({
        serviceType: this.hap.Service.Switch,
        characteristicType: this.hap.Characteristic.On,
        value: away,
      });
      this.away = away;
    }
  }

  private setAway(value: CharacteristicValue): Promise<void> {
    let postUpdate: Promise<FullStatus>;

    if (value === true) {
      postUpdate = this.client.enableAwayMode();
    } else {
      postUpdate = this.client.disableAwayMode();
    }

    return postUpdate.then((updated) => {
      this.update(updated.system.awayMode);
    });
  }
}
