;(function (MotionSensor) {

    var distance2 = function (v1, v2, i) {
        return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2));
    };

    var distance3 = function (v1, v2, i) {
        return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2) + Math.pow(v1[i+2] - v2[i+2], 2));
    };

    MotionSensor.ProcessorFirstPerson = function (motionSensor) {
        // IoC
        this.motionSensor = motionSensor;
        this.context = motionSensor.canvasContext;

        this.i = 0; // frame counter
        this.clustersBuffer = [];
        this.convexHull = new motionSensor.constructor.ConvexHull();
        this.superClustersBuffer = [];
    }

    MotionSensor.ProcessorFirstPerson.prototype.processCircularBuffer = function (originalImageData, imageDataBuffers) {
        this.i++;

        var imageDataBuffersN = imageDataBuffers.length;

        var ctx = this.context;

        var videodata = originalImageData,
            videopx = videodata.data,
            newdata = imageDataBuffers[imageDataBuffersN-1],
            newpx = newdata.data,
            len = newpx.length;

        var MOTION_COLOR_THRESHOLD = 50,
            SAMPLING_GRID_FACTOR = Math.floor(2/this.motionSensor.scale), // 2 - 8
            MOTION_ALPHA_THRESHOLD = 120,
            alpha = 0,
            gamma = 3,
            i = l = x = y = 0,
            w = VIDEO_WIDTH = this.motionSensor.VIDEO_WIDTH,
            h = VIDEO_HEIGHT = this.motionSensor.VIDEO_HEIGHT,
            vanishingLineY1 = h * 0.4;
            vanishingLineY2 = h * 0.6;

        var k = this.motionSensor.options.totalClusters,
            clusters = [],
            point;



        // compute clusters
        //clusters = MotionSensor.Cluster.upsertArrayFromPoints(this.clustersBuffer, points, k, this.motionSensor);
        this.clustersBuffer = clusters = [
            new MotionSensor.Cluster({
                id: 'above',
                centroid: new MotionSensor.Vector2(w/2, vanishingLineY1/2),
                versor: new MotionSensor.Vector2(0, -1),
                modulus: 0,
                points: [],
                pixels: [],
                boundaryPointIndices: [],
                acum: [0, 0],
                rgbFloat: new MotionSensor.Vector3(0, 255, 0),
                debugColor: MotionSensor.Cluster.randomPointColors[j]
            }),
            new MotionSensor.Cluster({
                id: 'below',
                centroid: new MotionSensor.Vector2(w/2, vanishingLineY2 + (h - vanishingLineY2)/2),
                versor: new MotionSensor.Vector2(0, 1),
                modulus: 0,
                points: [],
                pixels: [],
                boundaryPointIndices: [],
                acum: [0, 0],
                rgbFloat: new MotionSensor.Vector3(0, 255, 0),
                debugColor: MotionSensor.Cluster.randomPointColors[j]
            })
        ];

        // iterate through the main buffer and calculate the differences with previous
        for (i = 0; i < len; i += 4) {
            // change the alpha channel based on the frame color differences
            alpha = 255;
            for (var j = 0, l = imageDataBuffersN-1; j < l; j++) {
                if (distance3(imageDataBuffers[j].data, imageDataBuffers[j+1].data, i) < MOTION_COLOR_THRESHOLD) {
                    alpha -= 255/l;
                }
            }

            x = (i/4) % w;
            y = parseInt((i/4) / w);
            if (this.i > imageDataBuffersN && (!(x % SAMPLING_GRID_FACTOR) && !(y % SAMPLING_GRID_FACTOR)) && alpha > MOTION_ALPHA_THRESHOLD && (y < vanishingLineY1 || y > vanishingLineY2)) {
                if (Math.random() > 0.3) {
                    continue;
                }
                if (this.motionSensor.options.debug) {
                    newpx[i+3] = parseInt(alpha, 10);
                }
                var point = new MotionSensor.Pixel(
                    new MotionSensor.Vector2(x, y),
                    new MotionSensor.Vector3(newpx[i+0], newpx[i+1], newpx[i+2])
                );
                if (point.position.y < vanishingLineY1) {
                    clusters[0].points.push(point);
                } else if (point.position.y > vanishingLineY2) {
                    clusters[1].points.push(point);
                }
            }
        }

        // paint canvas with the latest camera frame
        ctx.putImageData(imageDataBuffers[imageDataBuffersN-1], 0, 0);


        for (var j = 0, k = clusters.length; j < k; j++) {
            var cluster = clusters[j];

            if (cluster.points.length < 3) { 
                continue;
            }

            /// <---
            var p, nx, ny, dx, dy, q, prevpx, c1, c2, cx = cy = countx = county = 0, maxpx = 30, pcounter = 0;

            for (i = 0, l = cluster.points.length; i < l; i++) {
                x = cluster.points[i].position.x;
                y = cluster.points[i].position.y;

                prevpx = imageDataBuffers[imageDataBuffersN-2].data;
                lastpx = imageDataBuffers[imageDataBuffersN-1].data;

                q = (y*w + x)*4;
                c1 = [lastpx[q+0], lastpx[q+1], lastpx[q+2]];

                cx = cy = 0;

                for (dx = 0; dx < maxpx; dx++) {
                    nx = x + dx;
                    q = (y*w + nx)*4;
                    c2 = [prevpx[q+0], prevpx[q+1], prevpx[q+2]];
                    if (distance3(c1, c2, 0) < 50) {
                        cx++;
                    } else {
                        break;
                    }
                }
                for (dx = 0; dx > -maxpx; dx--) {
                    nx = x + dx;
                    q = (y*w + nx)*4;
                    c2 = [prevpx[q+0], prevpx[q+1], prevpx[q+2]];
                    if (distance3(c1, c2, 0) < 50) {
                        cx--;
                    } else {
                        break;
                    }
                }
                for (dy = 0; dy < maxpx; dy++) {
                    ny = y + dy;
                    q = (ny*w + x)*4;
                    c2 = [prevpx[q+0], prevpx[q+1], prevpx[q+2]];
                    if (distance3(c1, c2, 0) < 50) {
                        cy++;
                    } else {
                        break;
                    }
                }
                for (dy = 0; dy > -maxpx; dy--) {
                    ny = y + dy;
                    q = (ny*w + x)*4;
                    c2 = [prevpx[q+0], prevpx[q+1], prevpx[q+2]];
                    if (distance3(c1, c2, 0) < 50) {
                        cy--;
                    } else {
                        break;
                    }
                }
                countx += cx;
                county += cy;
                pcounter++;
            }

            cluster.modulus = Math.sqrt(countx*countx + county*county);
            if (cluster.modulus) {
                cluster.versor.x = -countx/cluster.modulus;
                cluster.versor.y = -county/cluster.modulus;
            } else {
                cluster.versor.x = 1;
                cluster.versor.y = 0;
            }
            cluster.modulus *= (0.006 / Math.pow(this.motionSensor.scale,2));

            if (this.clustersBuffer[j]) { // ease centroid movement by using buffering
                cluster.centroid.x = (cluster.centroid.x + this.clustersBuffer[j].centroid.x)*.5;
                cluster.centroid.y = (cluster.centroid.y + this.clustersBuffer[j].centroid.y)*.5;
            }

            if (this.motionSensor.testVideo || this.motionSensor.testImage) {
                cluster.versor.x *= -1;
            }

            ///  --->
            this.clustersBuffer[j] = cluster; // update buffer
        }
        //console.log(clusters[0].versor, clusters[1].versor);

        this.context.beginPath();
        this.context.moveTo(0, vanishingLineY1);
        this.context.lineTo(w, vanishingLineY1);
        this.context.closePath();
        this.context.lineWidth = 2;
        this.context.strokeStyle = '#0f0';
        this.context.stroke();

        this.context.beginPath();
        this.context.moveTo(0, vanishingLineY2);
        this.context.lineTo(w, vanishingLineY2);
        this.context.closePath();
        this.context.lineWidth = 2;
        this.context.strokeStyle = '#0f0';
        this.context.stroke();


        this.motionSensor.trigger('processor:compute', [
            this.clustersBuffer,
            this.context,
            1
        ]);

    };

}(MotionSensor));
