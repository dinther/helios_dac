class ScanLine {
    #duration;
    #startDwell;
    #endDwell;
    #totalPoints;
    #odd = false;
    constructor(duration=2000, totalPoints=500, startDwell=15, endDwell=15){
        this.#duration = duration;
        this.#totalPoints = totalPoints;
        this.#startDwell = startDwell;
        this.#endDwell = endDwell;
    }
    getFrame(timeStamp){
        let f = timeStamp%this.#duration / this.#duration;
        this.#odd = !this.#odd;
        let y = Math.floor(f * 4095);
        let frame = [];
        for (let db = 0; db < this.#startDwell; db++) {
            let x = this.#odd? 4095 : 0;
            let point = new HELIOS.HeliosPoint(x, y, 0, 0, 0);
            frame.push(point);
        }
        let totalPoints = this.#totalPoints - this.#startDwell - this.#endDwell;
        for (let j = 0; j < totalPoints; j++) {
                let x = j/this.#totalPoints*4095;
                x = this.#odd? 4095 - x : x;
                const point = new HELIOS.HeliosPoint(x, y, Math.floor(timeStamp*1.2%255), Math.floor(timeStamp%255), Math.floor(timeStamp*1.7%255));
                frame.push(point);
        }
        for (let da = 0; da < this.#endDwell; da++) {
            let x = this.#odd? 4095 : 0;
            let point = new HELIOS.HeliosPoint(x, y, 0, 0, 0, 0);
            frame.push(point);
        }
        return frame;
    }
}