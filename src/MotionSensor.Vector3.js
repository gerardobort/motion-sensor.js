;(function (MotionSensor) {

    MotionSensor.Vector3 = function(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    };

    MotionSensor.Vector3.prototype.getDistance = function(v3) {
        return Math.sqrt(Math.pow(this.x - v3.x, 2) + Math.pow(this.y - v3.y, 2) + Math.pow(this.z - v3.z, 2));
    };

    MotionSensor.Vector3.prototype.dotProduct = function(k) {
        this.x*=k;
        this.y*=k;
        this.z*=k;
    };

}(MotionSensor));
