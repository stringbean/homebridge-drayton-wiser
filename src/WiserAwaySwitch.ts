import { BaseAccessory } from './BaseAccessory';
import { CharacteristicValue, Logger, Service } from 'homebridge';
import { HAP } from 'homebridge/lib/api';
import { FullStatus, WiserClient } from '@string-bean/drayton-wiser-client';

export class WiserAwaySwitch extends BaseAccessory {
  private away = false;

  constructor(service: Service, hap: HAP, log: Logger, client: WiserClient) {
    super(service, hap, log, client);
    const Characteristic = hap.Characteristic;

    this.registerCharacteristic({
      type: Characteristic.On,
      getter: () => this.away,
      setter: this.setAway.bind(this),
    });
  }

  update(away: boolean): void {
    if (this.away !== away) {
      this.service.updateCharacteristic(this.hap.Characteristic.On, away);
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
