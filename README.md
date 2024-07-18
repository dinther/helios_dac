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
    for(let i=0; i<15; i++) frame.push(new HELIOS.HeliosPoint(0, y, 0, 0, 0));          //  Blanking points
    for(let i=0; i<256; i++) frame.push(new HELIOS.HeliosPoint(i*16, y, 255-i, i, 0));  //  Line
    device.sendFrame(frame, 30000);
};
heliosDevice.connect();
heliosDevice.play();
```

Known issues:

It is possible some ports don't work. This is due to webUSB respecting permission settings in the registry.
Run regedit and fo to the folder shown below.
Computer\HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Enum\USB
Right click on USB and select permissions. Set permissions as permissable as you can.
(This might have been caused by zadig)

Make sure only one Helios Laser DAC is plugged in
Zadig 2.9
Select options - and select List all devices
In the dropdown select the Helios Laser DAC
It is says WinUSB on the left of the arrow then we are all good.
If that is not the case select WinUSB
Click on the dropdown arrow of the button below and select
"install driver" and click the button. This takes a few minutes.
Do this for every Helios Laser DAC
 
Start and Stop doesn't work right. there is a race condition I think.

## Live demo
https://dinther.github.io/helios_dac/


