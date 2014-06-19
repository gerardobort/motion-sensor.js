;(function (window, document) {

    MotionSensor.Vector4 = function(x, y, z, t) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.t = t;
    };

    MotionSensor.Vector4.prototype.getDistance = function(v4) {
        return Math.sqrt(0.5*Math.pow(this.x - v4.x, 2) + 0.5*Math.pow(this.y - v4.y, 2) + 10*Math.pow(this.z - v4.z, 2) + 10*Math.pow(this.t - v4.t, 2));
    };

    MotionSensor.Vector4.prototype.dotProduct = function(k) {
        this.x*=k;
        this.y*=k;
        this.z*=k;
        this.t*=k;
    };

}(window, document));
