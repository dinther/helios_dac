# helios_dac.js
Implementation of the Helios Laser DAC sdk using webUSB.
The Helios Laser DAC from [Bitlasers](https://bitlasers.com/helios-laser-dac/) is a pretty capable open source DAC. It connects to any show laser via the standard ILDA interface and is controlled via USB.
This means that my Beatline show laser software can drive the laser directly from the browser.

Index.html contains a demo on how to connect to the Helios Laser DAC and a suggestion on how to generate dynamic content in real time.

![image](https://github.com/user-attachments/assets/f46a6c42-49b0-422e-b3e6-58a7c2fffca0)


Known issues:

Start and Stop doesn't work right. there is a race condition I think.
Intensity field doesn't work which means no blanking either.

## Live demo
https://dinther.github.io/helios_dac/


