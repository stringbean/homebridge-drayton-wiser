import { API } from 'homebridge';
import { WiserPlatformPlugin } from './WiserPlatformPlugin';

export = (homebridge: API) => {
  homebridge.registerPlatform(
    'homebridge-drayton-wiser',
    'drayton-wiser',
    WiserPlatformPlugin,
  );
};
