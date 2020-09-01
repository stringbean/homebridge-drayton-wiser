<p align="center">
  <img src="https://raw.githubusercontent.com/stringbean/homebridge-drayton-wiser/master/branding/Homebridge_x_Wiser.svg?sanitise=true" width="500px" />
</p>

# homebridge-drayton-wiser

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![Travis](https://img.shields.io/travis/com/stringbean/homebridge-drayton-wiser)](https://travis-ci.com/github/stringbean/homebridge-drayton-wiser)
[![npm (scoped)](https://img.shields.io/npm/v/@string-bean/homebridge-drayton-wiser)](https://www.npmjs.com/package/@string-bean/homebridge-drayton-wiser)
![node support](https://img.shields.io/node/v-lts/@string-bean/homebridge-drayton-wiser)
[![Known Vulnerabilities](https://snyk.io/test/github/stringbean/homebridge-drayton-wiser/badge.svg)](https://snyk.io/test/github/stringbean/homebridge-drayton-wiser)


This [Homebridge](https://homebridge.io) plugin adds support for [Drayton Wiser](https://wiser.draytoncontrols.co.uk/)
heating control systems.

## Installation

Before starting, you will need to obtain the system secret from your Wiser HeatHub:

1. Press the 'setup' button on your HeatHub.
   - The setup light should start blinking.
2. Connect to the temporary WiFi network that the HeatHub creates (it should be called `WiserHeatXXX`).
3. Open the setup URL in a browser or REST client: http://192.168.8.1/secret/
4. Copy the long key that is shown.
5. Press the 'setup' button again.
   - The setup light should return to normal.

### Homebridge Config UI X

Search for 'wiser' on the plugins page and install 'Homebridge Drayton Wiser'. Then add your system secret and address
to the plugin settings.

### Manual Installation

Install the plugin:

```sh
sudo npm install -g --unsafe-perm
```

Then add your system config to `config.json`:

```json
{
  "platforms": [
    {
      "platform": "drayton-wiser",
      "secret": "<secret-key>"
    }
]
```

### Config Options

| Name              | Description                                                                   | Required | Default     |
| ----------------- | ----------------------------------------------------------------------------- | :------: | ----------- |
| `secret`          | Secret key for the HeatHub from device setup mode                             |    ✔     |             |
| `namePrefix`      | Hostname prefix used in HeatHub detection                                     |          | `WiserHeat` |
| `overrideAddress` | Disables auto-detection of HeatHub address                                    |          | `false`     |
| `address`         | IP address or hostname of the HeatHub (only used if `overrideAddress` is set) |          |             |
