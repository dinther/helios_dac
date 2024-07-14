/*
SDK for Helios Laser DAC class, SOURCE
By Paul van Dinther
based on the SDK from Gitle Mikkelsen

Dependencies:
WebUSB API

Standard: ES6+
*/

// Constants
const HELIOS_SDK_VERSION = 6;

const HELIOS_MAX_POINTS = 0x1000;
const HELIOS_MAX_RATE = 0xFFFF;
const HELIOS_MIN_RATE = 7;

const HELIOS_SUCCESS = 1;
const HELIOS_ERROR = -1;

export const HELIOS_FLAGS_DEFAULT = 0;
export const HELIOS_FLAGS_START_IMMEDIATELY = (1 << 0);
export const HELIOS_FLAGS_SINGLE_MODE = (1 << 1);
export const HELIOS_FLAGS_DONT_BLOCK = (1 << 2);

// USB properties
const HELIOS_VID = 0x1209;
const HELIOS_PID = 0xE500;
const EP_BULK_OUT = 0x02;
const EP_BULK_IN = 0x81;
const EP_INT_OUT = 0x06;
const EP_INT_IN = 0x83;

// Point data structure
export class HeliosPoint {
    constructor(x = 0, y = 0, r = 0, g = 0, b = 0, i = 0) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.g = g;
        this.b = b;
        this.i = i;
    }
}

export class HeliosDac {
    constructor() {
        this.initialised = false;
        this.deviceList = [];
    }

    async openDevices() {
        if (this.initialised) return this.deviceList.length;

        this.deviceList = [];
        try {
            const devices = await navigator.usb.getDevices();
            for (const device of devices) {
                if (device.vendorId === HELIOS_VID && device.productId === HELIOS_PID) {
                    await device.open();
                    await device.selectConfiguration(1);
                    await device.claimInterface(0);
                    this.deviceList.push(new HeliosDacDevice(device));
                }
            }
            this.initialised = true;
            return this.deviceList.length;
        } catch (error) {
            console.error('Error opening devices:', error);
            return -1;
        }
    }

    async closeDevices() {
        if (!this.initialised) return HELIOS_ERROR;

        this.initialised = false;
        for (const device of this.deviceList) {
            await device.close();
        }
        this.deviceList = [];
        return HELIOS_SUCCESS;
    }

    async writeFrame(devNum, pps, flags, points, numOfPoints) {
        if (!this.initialised) return HELIOS_ERROR;
        if (!points || numOfPoints > HELIOS_MAX_POINTS || pps > HELIOS_MAX_RATE || pps < HELIOS_MIN_RATE) return HELIOS_ERROR;

        const device = this.deviceList[devNum];
        if (!device) return HELIOS_ERROR;

        return await device.sendFrame(pps, flags, points, numOfPoints);
    }

    async getStatus(devNum) {
        if (!this.initialised) return HELIOS_ERROR;

        const device = this.deviceList[devNum];
        if (!device) return HELIOS_ERROR;

        return await device.getStatus();
    }

    async getFirmwareVersion(devNum) {
        if (!this.initialised) return HELIOS_ERROR;

        const device = this.deviceList[devNum];
        if (!device) return HELIOS_ERROR;

        return await device.getFirmwareVersion();
    }

    async getName(devNum) {
        if (!this.initialised) return HELIOS_ERROR;

        const device = this.deviceList[devNum];
        if (!device) return HELIOS_ERROR;

        return await device.getName();
    }

    async setName(devNum, name) {
        if (!this.initialised) return HELIOS_ERROR;

        const device = this.deviceList[devNum];
        if (!device) return HELIOS_ERROR;

        return await device.setName(name);
    }

    async stop(devNum) {
        if (!this.initialised) return HELIOS_ERROR;

        const device = this.deviceList[devNum];
        if (!device) return HELIOS_ERROR;

        return await device.stop();
    }

    async setShutter(devNum, level) {
        if (!this.initialised) return HELIOS_ERROR;

        const device = this.deviceList[devNum];
        if (!device) return HELIOS_ERROR;

        return await device.setShutter(level);
    }

    async eraseFirmware(devNum) {
        if (!this.initialised) return HELIOS_ERROR;

        const device = this.deviceList[devNum];
        if (!device) return HELIOS_ERROR;

        return await device.eraseFirmware();
    }
}

export class HeliosDacDevice {
    constructor(device) {
        this.device = device;
        this.frameReady = false;
        this.closed = true;
        this.frameBuffer = new ArrayBuffer(HELIOS_MAX_POINTS * 7 + 5);
        this.init();
    }

    async init() {
        await this.getFirmwareVersion();
        this.closed = false;
        this.frameHandler();
    }

    async sendFrame(pps, flags, points, numOfPoints) {
        if (this.closed || this.frameReady) return HELIOS_ERROR;

        let bufPos = 0;
        const frameBuffer = new Uint8Array(this.frameBuffer);

        for (let i = 0; i < numOfPoints; i++) {
            frameBuffer[bufPos++] = points[i].x >> 4;
            frameBuffer[bufPos++] = ((points[i].x & 0x0F) << 4) | (points[i].y >> 8);
            frameBuffer[bufPos++] = points[i].y & 0xFF;
            frameBuffer[bufPos++] = points[i].r;
            frameBuffer[bufPos++] = points[i].g;
            frameBuffer[bufPos++] = points[i].b;
            frameBuffer[bufPos++] = points[i].i;
        }
        frameBuffer[bufPos++] = pps & 0xFF;
        frameBuffer[bufPos++] = pps >> 8;
        frameBuffer[bufPos++] = numOfPoints & 0xFF;
        frameBuffer[bufPos++] = numOfPoints >> 8;
        frameBuffer[bufPos++] = flags;

        if (flags & HELIOS_FLAGS_DONT_BLOCK) {
            this.frameReady = true;
            return HELIOS_SUCCESS;
        } else {
            return await this.doFrame();
        }
    }

    async doFrame() {
        if (this.closed) return HELIOS_ERROR;

        try {
            await this.device.transferOut(2, this.frameBuffer);
            return HELIOS_SUCCESS;
        } catch (error) {
            console.error('Error sending frame:', error);
            return HELIOS_ERROR;
        }
    }

    async frameHandler() {
        while (!this.closed) {
            if (this.frameReady) {
                await this.doFrame();
                this.frameReady = false;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async getFirmwareVersion() {
        if (this.closed) return HELIOS_ERROR;

        try {
            const result = await this.device.controlTransferIn({
                requestType: 'vendor',
                recipient: 'device',
                request: 0x04,
                value: 0x00,
                index: 0x00
            }, 32);

            if (result.data && result.data.getUint8(0) === 0x84) {
                this.firmwareVersion = result.data.getUint32(1, true);
                return this.firmwareVersion;
            }
            return HELIOS_ERROR;
        } catch (error) {
            console.error('Error getting firmware version:', error);
            return HELIOS_ERROR;
        }
    }

    async getName() {
        if (this.closed) return HELIOS_ERROR;

        try {
            const result = await this.device.controlTransferIn({
                requestType: 'vendor',
                recipient: 'device',
                request: 0x05,
                value: 0x00,
                index: 0x00
            }, 32);

            if (result.data && result.data.getUint8(0) === 0x85) {
                const name = new TextDecoder().decode(result.data.buffer.slice(1));
                return name;
            }
            return HELIOS_ERROR;
        } catch (error) {
            console.error('Error getting name:', error);
            return HELIOS_ERROR;
        }
    }

    async setName(name) {
        if (this.closed) return HELIOS_ERROR;

        try {
            const nameArray = new TextEncoder().encode(name);
            await this.device.controlTransferOut({
                requestType: 'vendor',
                recipient: 'device',
                request: 0x06,
                value: 0x00,
                index: 0x00
            }, nameArray);

            return HELIOS_SUCCESS;
        } catch (error) {
            console.error('Error setting name:', error);
            return HELIOS_ERROR;
        }
    }

    async getStatus() {
        if (this.closed) return HELIOS_ERROR;

        try {
            const result = await this.device.controlTransferIn({
                requestType: 'vendor',
                recipient: 'device',
                request: 0x03,
                value: 0x00,
                index: 0x00
            }, 32);

            if (result.data && result.data.getUint8(0) === 0x83) {
                return result.data.getUint8(1) === 0 ? 0 : 1;
            }
            return HELIOS_ERROR;
        } catch (error) {
            console.error('Error getting status:', error);
            return HELIOS_ERROR;
        }
    }

    async setShutter(level) {
        if (this.closed) return HELIOS_ERROR;

        try {
            await this.device.controlTransferOut({
                requestType: 'vendor',
                recipient: 'device',
                request: 0x02,
                value: level ? 1 : 0,
                index: 0x00
            });

            return HELIOS_SUCCESS;
        } catch (error) {
            console.error('Error setting shutter:', error);
            return HELIOS_ERROR;
        }
    }

    async stop() {
        if (this.closed) return HELIOS_ERROR;

        try {
            await this.device.controlTransferOut({
                requestType: 'vendor',
                recipient: 'device',
                request: 0x01,
                value: 0x00,
                index: 0x00
            });

            await new Promise(resolve => setTimeout(resolve, 100));
            return HELIOS_SUCCESS;
        } catch (error) {
            console.error('Error stopping device:', error);
            return HELIOS_ERROR;
        }
    }

    async eraseFirmware() {
        if (this.closed) return HELIOS_ERROR;

        try {
            await this.device.controlTransferOut({
                requestType: 'vendor',
                recipient: 'device',
                request: 0x07,
                value: 0x00,
                index: 0x00
            });

            return HELIOS_SUCCESS;
        } catch (error) {
            console.error('Error erasing firmware:', error);
            return HELIOS_ERROR;
        }
    }

    async close() {
        if (this.closed) return;

        try {
            await this.stop();
            await this.device.close();
            this.closed = true;
        } catch (error) {
            console.error('Error closing device:', error);
        }
    }
}
