;(function (MotionSensor) {

    MotionSensor.Vector4 = function(x, y, z, t) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.t = t;
    };

    MotionSensor.Vector4.prototype.getDistance = function(v4) {
        // two pairs distance
        var d1 = Math.sqrt(Math.pow(this.x - v4.x, 2) + Math.pow(this.y - v4.y, 2));
        var d2 = Math.sqrt(Math.pow(this.z - v4.z, 2) + Math.pow(this.t - v4.t, 2));
        return Math.sqrt(0.1*Math.pow(d1, 2) + Math.pow(d2, 2));
    };

    MotionSensor.Vector4.prototype.dotProduct = function(k) {
        this.x*=k;
        this.y*=k;
        this.z*=k;
        this.t*=k;
    };

}(MotionSensor));
