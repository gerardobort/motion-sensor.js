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

    MotionSensor.Cluster.upsertArrayFromPoints = function (previousClusters, points, totalClusters) {
        var k = totalClusters,
            p = O = P = null,
            dMin = d = 0,
            jMin = 0,
            clusters = [],
            step = 0,
            maxSteps = 3,
            maxDelta = 70;

        // PAM algorythm (k-Means clustering)
        for (step = 0; step < maxSteps; step++) {
            for (j = 0; j < k; j++) {
                if (0 === step) {
                    if (!previousClusters[j]) {
                        x = parseInt(Math.random()*VIDEO_WIDTH, 10);
                        y = parseInt(Math.random()*VIDEO_HEIGHT, 10);
                        clusters.push(new MotionSensor.Cluster({
                            id: j,
                            centroid: new MotionSensor.Vector2(x, y),
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
                dMin = Number.MAX_VALUE;
                jMin = 0;
                for (j = 0; j < k; j++) {
                    O = [clusters[j].centroid.x, clusters[j].centroid.y];
                    P = [p.position.x, p.position.y];
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
                } else if (step < maxSteps) {
                    // means color
                    clusters[jMin].rgbFloat[0] += p.color.x/l;
                    clusters[jMin].rgbFloat[1] += p.color.y/l;
                    clusters[jMin].rgbFloat[2] += p.color.z/l;
                }
            }
        }
        return clusters;
    }

}(window, document));
