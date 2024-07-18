# helios_dac.js
Implementation of the Helios Laser DAC sdk using webUSB.
The Helios Laser DAC from [Bitlasers](https://bitlasers.com/helios-laser-dac/) is a pretty capable open source DAC. It connects to any show laser via the standard ILDA interface and is controlled via USB.
This means that my Beatline show laser software can drive the laser directly from the browser.

Index.html contains a demo on how to connect to the Helios Laser DAC and a suggestion on how to generate dynamic content in real time.

![image](https://github.com/user-attachments/assets/f46a6c42-49b0-422e-b3e6-58a7c2fffca0)

usage:
```javascript
let heliosDevice = await connectHeliosDevice();
heliosDevice.onFrame = (device)=>{
    let frame = [];
    let y = Math.floor(Date.now()%2000 / 2000 * 4095);
    for(let i=0; i<15; i++) frame.push(new HELIOS.HeliosPoint(0, y, 0, 0, 0));
    for(let i=0; i<256; i++) frame.push(new HELIOS.HeliosPoint(i*16, y, 255-i, i, 0));
    device.sendFrame(frame, 30000);
};
heliosDevice.connect();
heliosDevice.play();
```

Known issues:

Start and Stop doesn't work right. there is a race condition I think.

## Live demo
https://dinther.github.io/helios_dac/


