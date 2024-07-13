import * as Helios from './helios_dac.js';

const NUM_FRAMES = 30;
const POINTS_PER_FRAME = 1000;
const MAX_CYCLES = 150;
const PPS = 30000;
const FLAGS = Helios.HELIOS_FLAGS_DEFAULT;
const WAIT_LIMIT = 512;

async function createFrames() {
    const frames = [];
    for (let i = 0; i < NUM_FRAMES; i++) {
        const frame = [];
        const y = Math.floor(i * 0xFFF / NUM_FRAMES);
        for (let j = 0; j < POINTS_PER_FRAME; j++) {
            let x;
            if (j < POINTS_PER_FRAME / 2) {
                x = Math.floor(j * 0xFFF / (POINTS_PER_FRAME / 2));
            } else {
                x = 0xFFF - Math.floor((j - POINTS_PER_FRAME / 2) * 0xFFF / (POINTS_PER_FRAME / 2));
            }
            frame.push(new Helios.HeliosPoint(x, y, 0xD0, 0xFF, 0xD0, 0xFF));
        }
        frames.push(frame);
    }
    return frames;
}

async function waitForReadyStatus(helios, devNum) {
    for (let k = 0; k < WAIT_LIMIT; k++) {
        if (await helios.getStatus(devNum) === 1) {
            return true;
        }
    }
    return false;
}

async function sendFrames(helios, frames, numDevs) {
    let cycleCount = 0;
    while (cycleCount < MAX_CYCLES) {
        cycleCount++;
        for (let j = 0; j < numDevs; j++) {
            const isReady = await waitForReadyStatus(helios, j);
            if (isReady) {
                await Helios.writeFrame(j, PPS, FLAGS, frames[cycleCount % NUM_FRAMES], POINTS_PER_FRAME);
            }
        }
    }
}

async function main() {
    try {
        const frames = await createFrames();
        const helios = new Helios.HeliosDac();
        const numDevs = await helios.openDevices();

        await sendFrames(helios, frames, numDevs);

        await helios.closeDevices();
        console.log("Frames sent successfully and devices closed.");
    } catch (error) {
        console.log("An error occurred:", error);
    }
}

// Run the main function
main();