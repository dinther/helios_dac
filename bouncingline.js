class BouncingLine {
    #range
    #r;
    #hr;
    #dwell;
    #segmentLength;
    #startX
    #startY
    #endX
    #endY
    #deltaStartX
    #deltaStartY
    #deltaEndX
    #deltaEndY
    #r
    #g;
    #b;
    #odd = false;
    constructor(range = 4095, dwell=15, segmentLength = 40){
        this.#range = range;
        this.#dwell = dwell;
        this.#r = 30;
        this.#hr = this.#r/2;
        this.#segmentLength = segmentLength;
        this.#startX = Math.random()*this.#range;
        this.#startY = Math.random()*this.#range;
        this.#endX = Math.random()*this.#range;
        this.#endY = Math.random()*this.#range;
        this.#deltaStartX = Math.random()*this.#r-this.#hr;
        this.#deltaStartY = Math.random()*this.#r, this.#hr;
        this.#deltaEndX = Math.random()*this.#r, this.#hr;
        this.#deltaEndY = Math.random()*this.#r, this.#hr;
        this.#r = Math.random()*255;
        this.#g = Math.random()*255;
        this.#b = Math.random()*255;
    }
    #setrandomColor(){
        this.#r = Math.random()*255;
        this.#g = Math.random()*255;
        this.#b = Math.random()*255;
    }
    getFrame(){
        this.#startX += this.#deltaStartX;
        this.#startY += this.#deltaStartY;
        this.#endX += this.#deltaEndX;
        this.#endY += this.#deltaEndY;
    
        if(this.#startX < 0) {
            this.#deltaStartX = Math.random()*this.#hr;
            this.#setrandomColor();
        }
        if(this.#startX > this.#range){
            this.#deltaStartX = Math.random()*-this.#hr
            this.#setrandomColor();
        }
        if(this.#startY < 0){
            this.#deltaStartY = Math.random()*this.#hr;
            this.#setrandomColor();
        }
        if(this.#startY > this.#range){
            this.#deltaStartY = Math.random()*-this.#hr;
            this.#setrandomColor();
        }
        if(this.#endX < 0){
            this.#deltaEndX = Math.random()*this.#hr;
            this.#setrandomColor();
        }
        if(this.#endX > this.#range){
            this.#deltaEndX = Math.random()*-this.#hr;
            this.#setrandomColor();
        }
        if(this.#endY < 0){
            this.#deltaEndY = Math.random()*this.#hr;
            this.#setrandomColor();
        }
        if(this.#endY > this.#range){
            this.#deltaEndY = Math.random()*-this.#hr;
            this.#setrandomColor();
        }
        let dx = this.#endX - this.#startX;
        let dy = this.#endY - this.#startY;
        let dist = Math.hypot(dx, dy);
        let totalPoints = Math.floor(dist / segmentLength) + 1;
        dx /= totalPoints;
        dy /= totalPoints;
        let frame = [];
        if (totalPoints > 2){
            totalPoints =  totalPoints - this.#dwell - this.#dwell;
            for (let db = 0; db < this.#dwell; db++) {
                let point = new HELIOS.HeliosPoint(Math.floor(this.#startX), Math.floor(this.#startY), 0, 0, 0);
                frame.push(point);
            }
            
            for (let j = 0; j < totalPoints; j++) {
                let point = new HELIOS.HeliosPoint(Math.floor(this.#startX + (dx*j)), Math.floor(this.#startY+(dy*j)), Math.floor(this.#r), Math.floor(this.#g), Math.floor(this.#b));
                frame.push(point);
            }
            for (let da = 0; da < this.#dwell; da++) {
                let point = new HELIOS.HeliosPoint(Math.floor(this.#endX), Math.floor(this.#endY), 0, 0, 0);
                frame.push(point);
            }
        }
        return frame;
    }
}
