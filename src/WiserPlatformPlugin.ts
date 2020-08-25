import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
} from 'homebridge';
import { Observable, timer } from 'rxjs';
import { Room, WiserClient } from '@string-bean/drayton-wiser-client';
import { WiserThermostatAccessory } from './WiserThermostatAccessory';

export class WiserPlatformPlugin implements DynamicPlatformPlugin {
  private updateInterval?: Observable<number>;
  private wiserClient: WiserClient;

  private accessories: Map<string, PlatformAccessory> = new Map();
  private thermostats: Map<string, WiserThermostatAccessory> = new Map();

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    log.info('Loading Drayton Wiser platform');

    this.wiserClient = new WiserClient(config.secret, config.ip);

    api.on('didFinishLaunching', () => {
      // TODO can this be created unstarted
      this.updateInterval = timer(0, 5000);

      this.updateInterval.subscribe(() => {
        this.log.debug('Polling system');
        // TODO await
        this.updateSystem();
      });
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.accessories.set(accessory.UUID, accessory);
  }

  private async updateSystem() {
    const rooms: Room[] = await this.wiserClient.roomStatuses();

    const currentAccessories: [PlatformAccessory, boolean][] = rooms
      .filter((room) => room.isValid)
      .map((room) => this.createThermostat(room));

    const staleAccessories = Array.from(this.accessories.values()).filter(
      (existing) =>
        !currentAccessories.find(([current]) => current.UUID === existing.UUID),
    );

    if (staleAccessories.length) {
      this.log.info(`Removing ${staleAccessories.length} stale accessories`);
      this.api.unregisterPlatformAccessories(
        'homebridge-drayton-wiser',
        'drayton-wiser',
        staleAccessories,
      );
    }

    const newAccessories = currentAccessories
      .filter(([, isNew]) => isNew)
      .map(([accessory]) => accessory);

    if (newAccessories.length) {
      this.log.info(`Found ${newAccessories.length} new accessories`);
    }

    if (newAccessories.length) {
      this.api.registerPlatformAccessories(
        'homebridge-drayton-wiser',
        'drayton-wiser',
        newAccessories,
      );
    }
  }

  private createThermostat(room: Room): [PlatformAccessory, boolean] {
    const uuid = this.api.hap.uuid.generate(`drayton-wiser:1:${room.id}`);
    this.log.debug(`configuring thermostat ${room.id} (${uuid}`);

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
        new WiserThermostatAccessory(service, room, this.api.hap, this.log),
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
