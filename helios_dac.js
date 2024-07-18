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

const HELIOS_SUCCESS = 1;  //  A valid test result
const HELIOS_FAIL = 0;     //  A valid test result
const HELIOS_ERROR = -1;   //  Abnormal fail

const HELIOS_FLAGS_DEFAULT = 0;
const HELIOS_FLAGS_START_IMMEDIATELY = (1 << 0);
const HELIOS_FLAGS_SINGLE_MODE = (1 << 1);
//  export const HELIOS_FLAGS_DONT_BLOCK = (1 << 2); //not applicable to javascript. Everything is non blocking

// USB properties
const HELIOS_VID = 0x1209;
const HELIOS_PID = 0xE500;

const MAX_GET_STATUS_RETRIES = 512;

const EP_BULK_OUT = 0x02;
const EP_BULK_IN = 0x81;
const EP_INT_OUT = 0x06;
const EP_INT_IN = 0x03;

const HELIOS_STOP_COMMAND = 0x01;
const HELIOS_GET_STATUS_COMMAND = 0x03;
const HELIOS_GET_FIRMWARE_VERSION_COMMAND = 0x04;
const HELIOS_GET_NAME_COMMAND = 0x05;
const HELIOS_SET_NAME_COMMAND = 0x06;
const HELIOS_ERASE_FIRMWARE_COMMAND = 0x07;


const HELIOS_STATUS_RESPONSE_CODE = 0x83;
const HELIOS_FIRMWARE_VERSION_RESPONSE_CODE = 0x84;
const HELIOS_GET_NAME_RESPONSE_CODE = 0x85;

//const EP_INT_IN = 0x83;  // this is a command response code?

// Point data structure
export class HeliosPoint {
    constructor(x = 0, y = 0, r = 0, g = 0, b = 0, i) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.g = g;
        this.b = b;
        this.i = (i===undefined)? (r|g|b==0)? 0 : 255 : i;
    }
}

export async function connectHeliosDevice(){
    let usbDevice = await navigator.usb.requestDevice({ filters: [{vendorId: HELIOS_VID, classCode: HELIOS_PID}]});
    return (usbDevice)? new HeliosDevice(usbDevice) : null;
}

export async function getHeliosDevices(){
    let devices = await navigator.usb.getDevices();
    let heliosDevices = [];
    for (const usbDevice of devices) {
        if (usbDevice.vendorId === HELIOS_VID && usbDevice.productId === HELIOS_PID) {
            let dacDevice = new HeliosDevice(usbDevice);
            heliosDevices.push(dacDevice);
        }
    }
    return heliosDevices;
}

/*
export class HeliosDacManager {
    constructor() {
        this.initialized = false;
        this.deviceList = [];
    }

    async openDevices() {
        if (this.initialized) return this.deviceList.length;

        this.deviceList = [];
        try {
            let devices = await navigator.usb.getDevices();
            for (const device of devices) {
                if (device.vendorId === HELIOS_VID && device.productId === HELIOS_PID) {
                    await device.open();
                    await device.selectConfiguration(1);
                    await device.claimInterface(0);
                    await device.selectAlternateInterface(0,1);
                    let dacDevice = new HeliosDacDevice(device);
                    await dacDevice.getFirmwareVersion();
                    await dacDevice.getName();
                    this.deviceList.push(dacDevice);
                }
            }
            this.initialized = true;
            return this.deviceList.length;
        } catch (error) {
            console.error('Error opening devices:', error);
            return -1;
        }
    }

    async closeDevices() {
        if (!this.initialized) return HELIOS_ERROR;

        this.initialized = false;
        for (const device of this.deviceList) {
            await device.close();
        }
        this.deviceList = [];
        return HELIOS_SUCCESS;
    }
}
    */

export class HeliosDevice{
    #running = false;
    #firmwareVersion;
    #name;
    constructor(usbDevice) {
        this.usbDevice = usbDevice;
        this.frameReady = false;
        this.closed = true;
        this.#firmwareVersion = 0;
        this.#name = '';
        this.frameBuffer = new ArrayBuffer(HELIOS_MAX_POINTS * 7 + 5);
        this.onFrame = null;
        //this.init();
    }

    #DataViewToString(dataView, offset=1){
        let o = Math.min(offset, dataView.byteLength);
        let result = '';
        for(let i=o; i<dataView.byteLength; i++){
            if (dataView.getUint8(i)==0) return result;
            result += String.fromCharCode(dataView.getUint8(i));
        }
    }

    async connect() {
        await this.usbDevice.open();
        await this.usbDevice.selectConfiguration(1);
        await this.usbDevice.claimInterface(0);
        await this.usbDevice.selectAlternateInterface(0,1);
        await this.init();
    }

    async init() {
        this.closed = false;
        await this.#getFirmwareVersion();
        await this.#getName();
        //this.frameHandler();
        //this.handleRunning(); 
    }

    async sendControl(buffer, receiveLength){
        try {
            await this.usbDevice.transferOut(EP_INT_OUT, buffer);
            return await this.usbDevice.transferIn(EP_INT_IN, receiveLength);
        } catch (error) {
            console.error('Error getting status:', error);
            return HELIOS_ERROR;
        }
    }

    async sendFrame(points=null, pps=30000, singleShot=false, interuptFrame=false) {
        if ( points == null ||
             points.length > HELIOS_MAX_POINTS ||
             pps > HELIOS_MAX_RATE ||
             pps < HELIOS_MIN_RATE ||
             this.closed ||
             this.frameReady ) return HELIOS_ERROR;

        let bufPos = 0;
        const _frameBuffer = new Uint8Array(points.length * 7 + 5);

        let ppsActual = pps;
        let numOfPointsActual = points.length;
        if (((points.length - 45) % 64) === 0) {
            numOfPointsActual--;
            // adjust pps to keep the same frame duration even with one less point
            ppsActual = Math.round(pps * (numOfPointsActual / points.length));
        }
        let flags = HELIOS_FLAGS_DEFAULT;
        if (singleShot) flags = flags|HELIOS_FLAGS_SINGLE_MODE;
        if (interuptFrame) flags = flags|HELIOS_FLAGS_START_IMMEDIATELY;
        for (let i = 0; i < points.length; i++) {
            _frameBuffer[bufPos++] = points[i].x >> 4;
            _frameBuffer[bufPos++] = ((points[i].x & 0x0F) << 4) | (points[i].y >> 8);
            _frameBuffer[bufPos++] = points[i].y & 0xFF;
            _frameBuffer[bufPos++] = points[i].r;
            _frameBuffer[bufPos++] = points[i].g;
            _frameBuffer[bufPos++] = points[i].b;
            _frameBuffer[bufPos++] = points[i].i;
        }
        _frameBuffer[bufPos++] = ppsActual & 0xFF;
        _frameBuffer[bufPos++] = ppsActual >> 8;
        _frameBuffer[bufPos++] = numOfPointsActual & 0xFF;
        _frameBuffer[bufPos++] = numOfPointsActual >> 8;
        _frameBuffer[bufPos++] = flags;

        //if (flags & HELIOS_FLAGS_DONT_BLOCK) {
        //    this.frameReady = true;
         //   return HELIOS_SUCCESS;
        //} else {
        return await this.doFrame(_frameBuffer);
        //}
    }

    async doFrame(_frameBuffer) {
        if (this.closed) return HELIOS_ERROR;

        try {
            await this.usbDevice.transferOut(EP_BULK_OUT, _frameBuffer);
            return HELIOS_SUCCESS;
        } catch (error) {
            console.error('Error sending frame:', error);
            return HELIOS_ERROR;
        }
    }

    /*
    async frameHandler() {
        while (!this.closed) {
            if (this.frameReady) {
                await this.doFrame();
                this.frameReady = false;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
*/

    async #playloop(){        
        this.#running = true;
        console.log('start playloop');
        while(!this.closed && this.#running){
            console.log('before getStatus');
            let ready = await this.getStatus();
            console.log('after getStatus');
            if (ready){
                if (this.onFrame){
                    console.log('before onFrame');
                    await this.onFrame(this);
                    console.log('after onFrame');
                }
            }
        }
        console.log('stop playloop');
    }

    async #getFirmwareVersion() {
    	if (this.closed) return HELIOS_ERROR;
        let retry = 3;
        
        const buffer = new Uint8Array(2);
        buffer[0] = HELIOS_GET_FIRMWARE_VERSION_COMMAND;
        buffer[1] = 0;
        try {
            while(retry > 0){
                const result = await this.sendControl(buffer,2);
                if (result.status=='ok'&& result.data && result.data.byteLength >= 2 && result.data.getUint8(0) === HELIOS_FIRMWARE_VERSION_RESPONSE_CODE){
                    this.#firmwareVersion = result.data.getUint8(1);
                    return this.#firmwareVersion;
                }
                retry--;
            }
            return HELIOS_ERROR;
        } catch (error) {
            console.error('Error getting firmware version:', error);
            return HELIOS_ERROR;
        }
    }

    async #getName() {
        if (this.closed) return HELIOS_ERROR;

        try {
            const buffer = new Uint8Array(2);
            buffer[0] = HELIOS_GET_NAME_COMMAND;
            buffer[1] = 0;
            let retry = 3;
            while(retry > 0){
                const result = await this.sendControl(buffer,32);
                if (result.status=='ok' && result.data && result.data.byteLength >= 3 && result.data.getUint8(0) === HELIOS_GET_NAME_RESPONSE_CODE){
                    this.#name = this.#DataViewToString(result.data, 1);
                    return this.name;
                }
                retry--;
            }
            return HELIOS_ERROR;
        } catch (error) {
            console.error('Error getting name:', error);
            return HELIOS_ERROR;
        }
    }

    async #setName(name) {
        if (this.closed) return HELIOS_ERROR;

        try {
            let encoder = new TextEncoder();
            const buffer = new Uint8Array(32);
            buffer[0] = HELIOS_SET_NAME_COMMAND;
            let encodeResult = encoder.encodeInto(name.substr(0,31), buffer.subarray(1));
            const result = await this.sendControl(buffer, 32);  
            if (result.status=='ok'){
                this.name = new TextDecoder().decode(buffer.slice(1));
                return HELIOS_SUCCESS;
            } else {
                return HELIOS_FAIL;
            }
            return HELIOS_SUCCESS;
        } catch (error) {
            console.error('Error setting name:', error);
            return HELIOS_ERROR;
        }
    }

    //  Gets status of DAC, true means DAC is ready to receive frame, false means it is not
    async getStatus() {
        if (this.closed) return HELIOS_ERROR;
        try {
            const buffer = new Uint8Array(2);
            buffer[0] = HELIOS_GET_STATUS_COMMAND;
            buffer[1] = 0;
            let retry = MAX_GET_STATUS_RETRIES;

            while(retry > 0){
                const result = await this.sendControl(buffer, 2);           
                if (result.status=='ok' && result.data && result.data.getUint8(0) === HELIOS_STATUS_RESPONSE_CODE) {
                    if (result.data.getUint8(1) === 1){
                        return HELIOS_SUCCESS;
                    } else {
                        retry--;
                    }
                }				
            }
            return HELIOS_FAIL;
        } catch (error) {
            console.error('Error getting status:', error);
            return HELIOS_ERROR;
        }
    }

    async setShutter(level) {
        if (this.closed) return HELIOS_ERROR;

        try {
            const buffer = new Uint8Array(2);
            buffer[0] = HELIOS_SET_SHUTTER_COMMAND;
            buffer[1] = level;
            const result = await this.sendControl(buffer,2);
            if (result.status=='ok'){
                return HELIOS_SUCCESS;
            } else {
                return HELIOS_FAIL;
            }
        } catch (error) {
            console.error('Error setting shutter:', error);
            return HELIOS_ERROR;
        }
    }

    async start(){
        if (this.closed) return HELIOS_ERROR;
        this.#playloop();
         
    }

    async stop() {
        this.#running = false;
        if (this.closed) return HELIOS_ERROR;
        const buffer = new Uint8Array(2);
        buffer[0] = HELIOS_STOP_COMMAND;
        buffer[1] = 0;
        let retry = 3;
        try {
            while(retry>0){
                const result = await this.sendControl(buffer, 2); 
                if (result.status=='ok'){
                    // add 100ms wait before moving on. Not sure why but it is in the original c++ code
                    await new Promise(resolve => setTimeout(resolve, 100)); 
                    return HELIOS_SUCCESS;
                }
                retry--;
            }
            return HELIOS_ERROR;
        } catch (error) {
            console.error('Error stopping device:', error);
            retry--;
            if (retry==0) return HELIOS_ERROR;
        }
    }


    //  For webUSB this needs hardening up. It is a possible attack vector leaving the 
    //  Helios DAC without firmware.
    async eraseFirmware() {
        if (this.closed) return HELIOS_ERROR;
        const buffer = new Uint8Array(2);
        buffer[0] = HELIOS_ERASE_FIRMWARE_COMMAND;
        buffer[1] = 0;
        try{       
            const result = await this.sendControl(buffer, 2); 
            if (result.status=='ok'){
                return HELIOS_SUCCESS;
            } else {
                return HELIOS_FAIL;
            }
        } catch (error) {
            console.error('Error erasing firmware:', error);
            return HELIOS_ERROR;
        }
    }

    async close() {
        if (this.closed) return;

        try {
            await this.stop();
            await this.usbDevice.close();
            this.closed = true;
        } catch (error) {
            console.error('Error closing device:', error);
        }
    }

    get name(){
        return this.#name;
    }

    set name(value){
        this.#setName(value);
    }

    get firmwareVersion(){
        return this.#firmwareVersion;
    }

    get manufacturerName(){
        return this.usbDevice.manufacturerName;
    }

    get productName(){
        return this.usbDevice.productName;
    }
}
