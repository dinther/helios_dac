# helios_dac.js
Implementation of the Helios DAC sdk using webUSB.
The Helios DAC from [Bitlasers](https://bitlasers.com/helios-laser-dac/) is a pretty capable open source DAC. It connects to any show laser via the standard ILDA interface and is controlled via USB.
This means that my Beatline show laser software can drive the laser directly from the browser.

Index.html contains a demo on how to connect to the Helios dac and a suggestion on how to generate dynamic content in real time.

Known issues:

Start and Stop doesn't work right. there is a race condition I think.
Intensity field doesn't work which means no blanking either.

https://dinther.github.io/helios_dac/


