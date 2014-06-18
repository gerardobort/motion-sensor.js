;(function (window, document) {


    MotionSensor.Cluster = function(options) {
        for (k in options) {
          if (options.hasOwnProperty(k)) {
             this[k] = options[k];
          }
        };
    };

    MotionSensor.Cluster.randomPointColors = [];
    var r, g, b;
    for (var i = 0; i < 100; i++) {
        r = Math.floor(Math.random()*255);
        g = Math.floor(Math.random()*255);
        b = Math.floor(Math.random()*255);
        MotionSensor.Cluster.randomPointColors.push('rgba(' + r + ', ' + g + ', ' + b + ', 0.6)');
    }

    /**
     * Adapter for clusterfck K-means library (WIP)
     */
    MotionSensor.Cluster.upsertArrayFromPoints_HCluster = function (previousClusters, points) {
        points.forEach(function (point) {
            point.vector = [point.position.x, point.position.y];
        });
        if (!points.length) return [];
        var clusters = clusterfck.hcluster(points);
        //console.log(points, clusters);
        //throw 'ahh';
    };

    MotionSensor.Cluster.upsertArrayFromPoints_KMeans = function (previousClusters, points, K) {
    };

    /**
     * Implements basic K-means algorythm
     */
    MotionSensor.Cluster.upsertArrayFromPoints = function (previousClusters, points, K, motionSensor, level) {
        var k = K,
            p,
            dMin = d = 0,
            jMin = 0,
            clusters = [],
            step = 0,
            maxSteps = 3,
            maxDelta = 70,
            w = VIDEO_WIDTH = motionSensor.VIDEO_WIDTH,
            h = VIDEO_HEIGHT = motionSensor.VIDEO_HEIGHT;

        var x,y,z,t;

        var cluster, j;
        for (j = 0; j < k; j++) {
            cluster = previousClusters[j];
            if (cluster) {
                var centroidPixel = new MotionSensor.Pixel(cluster.centroid, cluster.rgbFloat);
                // ensure we have at leaset three points initially
                points = points.concat([centroidPixel, centroidPixel, centroidPixel]);
            }
        }

        // PAM algorythm (k-Means clustering)
        for (step = 0; step < maxSteps; step++) {
            for (j = 0; j < k; j++) {
                if (0 === step) {
                    if (!previousClusters[j]) {
                        x = Math.floor(Math.random()*VIDEO_WIDTH);
                        y = Math.floor(Math.random()*VIDEO_HEIGHT);
                        if (2 === level) {
                          z = Math.random();
                          t = Math.random();
                        }
                        clusters.push(new MotionSensor.Cluster({
                            id: j,
                            centroid: (level !== 2 ? new MotionSensor.Vector2(x, y) : new MotionSensor.Vector4(x, y, z, t)),
                            versor: new MotionSensor.Vector2(1, 0),
                            modulus: 0,
                            points: [],
                            pixels: [],
                            boundaryPointIndices: [],
                            acum: [0, 0],
                            rgbFloat: new MotionSensor.Vector3(0, 0, 0),
                            debugColor: MotionSensor.Cluster.randomPointColors[j]
                        }));
                    } else {
                        previousClusters[j].rgbFloat.dotProduct(0.8);
                        clusters.push(previousClusters[j]);
                    }
                } else {
                    // re-assign cluster x,y
                    clusters[j].centroid.x = clusters[j].acum[0]/clusters[j].points.length;
                    clusters[j].centroid.y = clusters[j].acum[1]/clusters[j].points.length;
                    clusters[j].points = [];
                    clusters[j].pixels = [];
                    clusters[j].boundaryPointIndices = [];
                    clusters[j].acum = [0, 0];
                }
            }

            for (i = 0, l = points.length; i < l; i++) {
                p = points[i];
                if (!p) { continue; }
                dMin = Number.MAX_VALUE;
                jMin = 0;
                for (j = 0; j < k; j++) {
                    if ((d = p.position.getDistance(clusters[j].centroid)) < dMin) {
                        dMin = d;
                        jMin = j;
                    }
                }
                if ((step !== maxSteps-1 || dMin < maxDelta) && clusters[jMin]) {
                    clusters[jMin].points.push(p.position);
                    clusters[jMin].pixels.push(p);
                    clusters[jMin].acum[0] += p.position.x;
                    clusters[jMin].acum[1] += p.position.y;
                    // means color
                    clusters[jMin].rgbFloat.x += p.color.x/l;
                    clusters[jMin].rgbFloat.y += p.color.y/l;
                    clusters[jMin].rgbFloat.z += p.color.z/l;
                }
            }
        }
        return clusters;
    }

}(window, document));
