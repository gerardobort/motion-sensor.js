;(function (MotionSensor) {

    MotionSensor.Vector2 = function(x, y) {
        this.x = x;
        this.y = y;
    };

    MotionSensor.Vector2.prototype.getDistance = function(v2) {
        return Math.sqrt(Math.pow(this.x - v2.x, 2) + Math.pow(this.y - v2.y, 2));
    };


}(MotionSensor));
