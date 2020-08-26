# homebridge-drayton-wiser

This [Homebridge](https://homebridge.io) plugin adds support for [Drayton Wiser](https://wiser.draytoncontrols.co.uk/)
heating control systems.

## Installation

Before starting you will need to obtain the system secret from your Wiser HeatHub:

1. Press the 'setup' button on your HeatHub.
   - The setup light should start blinking.
2. Connect to the temporary WiFi network that the HeatHub creates (it should be called `WiserHeatXXX`).
3. Open the setup URL in a browser or REST client: http://192.168.8.1/secret/
4. Copy the long key that is shown.
5. Press the 'setup' button again.
   - The setup light should return to normal.

You will also need the IP address of your HeatHub - you should be able to find this from your router (it normally
appears as `WiserHeatXXX`).

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
      "secret": "<secret-key>",
      "address": "<ip address>"
    }
]
```
