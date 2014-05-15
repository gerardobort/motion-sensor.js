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


}(window, document));
