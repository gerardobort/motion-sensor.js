;(function (window, document) {


    MotionSensor.Cluster = function(id, centroid, versor, modulus, points, pixels, boundaryPointIndices, acum, rgbFloat, debugColor) {
        this.id = id;
        this.centroid = new MotionSensor.Vector2(centroid[0], centroid[1]);
        this.versor = new MotionSensor.Vector2(versor[0], versor[1]);
        this.modulus = modulus;
        this.points = points.map(function (point) { return new MotionSensor.Vector2(point[0], point[1]); });
        this.pixels = []; // TODO ??
        this.boundaryPointIndices = boundaryPointIndices;
        this.acum = acum;
        this.rgbFloat = new MotionSensor.Vector3(rgbFloat);
        this.debugColor = debugColor;
    };

    var swapProp = function (a, b, prop) {
        var tmpVal = a[prop];
        a[prop] = b[prop];
        b[prop] = tmpVal;
    };
    MotionSensor.Cluster.prototype.swap = function (cluster) {
        swapProp(this, cluster, 'centroid');
        swapProp(this, cluster, 'points');
        swapProp(this, cluster, 'pixels');
        swapProp(this, cluster, 'boundaryPointIndices');
    };


}(window, document));
