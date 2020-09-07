import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
} from 'homebridge';
import { Subscription, timer } from 'rxjs';
import { Room, WiserClient } from '@string-bean/drayton-wiser-client';
import { WiserThermostatAccessory } from './WiserThermostatAccessory';
import { WiserAwaySwitch } from './WiserAwaySwitch';

const POLL_INTERVAL = 60 * 1000;

export class WiserPlatformPlugin implements DynamicPlatformPlugin {
  private updateSubscription?: Subscription;
  private readonly wiserClient?: WiserClient;

  private readonly accessories: Map<string, PlatformAccessory> = new Map();
  private readonly thermostats: Map<
    string,
    WiserThermostatAccessory
  > = new Map();

  private awaySwitch?: WiserAwaySwitch;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    if (!config) {
      log.warn('Missing plugin config - please update config.json');
      return;
    }

    if (!config.secret) {
      log.warn('Invalid config - missing secret');
      return;
    }

    if (config.overrideAddress) {
      if (!config.address) {
        log.warn('Invalid config - overrideConfig is set without address');
        return;
      }

      this.wiserClient = WiserClient.clientWithAddress(
        config.secret,
        config.address,
      );
    } else {
      this.wiserClient = WiserClient.clientWithDiscovery(
        config.secret,
        config.namePrefix,
      );
    }

    log.info('Loading Drayton Wiser platform');

    api.on('didFinishLaunching', () => {
      this.updateSubscription = timer(0, POLL_INTERVAL)
        .pipe()
        .subscribe(() => {
          this.log.debug('Polling system');

          this.updateSystem().catch((error) => {
            this.log.error('Error during system update', error);
          });
        });
    });

    api.on('shutdown', () => {
      if (this.updateSubscription) {
        this.updateSubscription.unsubscribe();
      }
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.accessories.set(accessory.UUID, accessory);
  }

  private async updateSystem() {
    if (!this.wiserClient) {
      return;
    }

    const currentAccessories: PlatformAccessory[] = [];

    await this.updateAway(this.wiserClient, currentAccessories);
    await this.updateRooms(this.wiserClient, currentAccessories);

    const staleAccessories = Array.from(this.accessories.values()).filter(
      (existing) =>
        !currentAccessories.find((current) => current.UUID === existing.UUID),
    );

    if (staleAccessories.length) {
      this.log.info(`Removing ${staleAccessories.length} stale accessories`);
      this.api.unregisterPlatformAccessories(
        'homebridge-drayton-wiser',
        'drayton-wiser',
        staleAccessories,
      );
    }
  }

  private async updateAway(
    client: WiserClient,
    currentAccessories: PlatformAccessory[],
  ): Promise<void> {
    const status = await client.systemStatus();

    const uuid = this.api.hap.uuid.generate('drayton-wiser:1:away');

    if (!this.accessories.has(uuid)) {
      const accessory = new this.api.platformAccessory('Away Mode', uuid);
      this.accessories.set(uuid, accessory);

      this.api.registerPlatformAccessories(
        'homebridge-drayton-wiser',
        'drayton-wiser',
        [accessory],
      );
    }

    const awayAccessory = <PlatformAccessory>this.accessories.get(uuid);

    if (!this.awaySwitch) {
      const service = WiserPlatformPlugin.getOrCreateService(
        awayAccessory,
        this.api.hap.Service.Switch,
      );

      this.awaySwitch = new WiserAwaySwitch(
        service,
        this.api.hap,
        this.log,
        client,
      );
    }

    this.awaySwitch.update(status.awayMode);
    currentAccessories.push(awayAccessory);
  }

  private async updateRooms(
    client: WiserClient,
    currentAccessories: PlatformAccessory[],
  ) {
    const rooms: Room[] = await client.roomStatuses();

    const thermostats: [PlatformAccessory, boolean][] = rooms
      .filter((room) => room.isValid)
      .map((room) => this.createThermostat(room));

    const newAccessories = thermostats
      .filter(([, isNew]) => isNew)
      .map(([accessory]) => accessory);

    if (newAccessories.length) {
      this.log.info(`Found ${newAccessories.length} new rooms`);
    }

    if (newAccessories.length) {
      this.api.registerPlatformAccessories(
        'homebridge-drayton-wiser',
        'drayton-wiser',
        newAccessories,
      );
    }

    currentAccessories.push(...thermostats.map(([thermostat]) => thermostat));
  }

  private createThermostat(room: Room): [PlatformAccessory, boolean] {
    const uuid = this.api.hap.uuid.generate(`drayton-wiser:1:${room.id}`);
    this.log.debug(`configuring thermostat ${room.id} (${uuid})`);

    let newAccessory = false;

    if (!this.accessories.has(uuid)) {
      this.accessories.set(
        uuid,
        new this.api.platformAccessory(room.name, uuid),
      );
      newAccessory = true;
    }

    const accessory = <PlatformAccessory>this.accessories.get(uuid);
    this.updateAccessoryInformation(accessory, room);

    if (!this.thermostats.has(uuid)) {
      const service = WiserPlatformPlugin.getOrCreateService(
        accessory,
        this.api.hap.Service.Thermostat,
      );

      this.thermostats.set(
        uuid,
        new WiserThermostatAccessory(
          service,
          this.api.hap,
          this.log,
          this.wiserClient!,
          room,
        ),
      );
    }

    const thermostat = <WiserThermostatAccessory>this.thermostats.get(uuid);
    thermostat.update(room);

    return [accessory, newAccessory];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private updateAccessoryInformation(accessory: PlatformAccessory, room: Room) {
    WiserPlatformPlugin.getOrCreateService(
      accessory,
      this.api.hap.Service.AccessoryInformation,
    )
      .setCharacteristic(this.api.hap.Characteristic.Manufacturer, 'Drayton')
      .setCharacteristic(this.api.hap.Characteristic.Model, 'iTRV');
    // TODO serial
  }

  // TODO wtf type should serviceType be?
  private static getOrCreateService(
    accessory: PlatformAccessory,
    serviceType: any,
  ) {
    const service = accessory.getService(serviceType);

    if (service) {
      return service;
    }

    return accessory.addService(serviceType);
  }
}
