;(function (window, document) {

    var distance2 = function (v1, v2, i) {
        return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2));
    };

    var distance3 = function (v1, v2, i) {
        return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2) + Math.pow(v1[i+2] - v2[i+2], 2));
    };

    MotionSensor.Processor2ClusterLevels = function (motionSensor) {
        // IoC
        this.motionSensor = motionSensor;
        this.context = motionSensor.canvasContext;

        this.i = 0; // frame counter
        this.clustersBuffer = [];
        this.convexHull = new motionSensor.constructor.ConvexHull();
        this.superClustersBuffer = [];
    }

    MotionSensor.Processor2ClusterLevels.prototype.processCircularBuffer = function (originalImageData, imageDataBuffers) {
        this.i++;

        var imageDataBuffersN = imageDataBuffers.length;

        var ctx = this.context;

        var videodata = originalImageData,
            videopx = videodata.data,
            newdata = imageDataBuffers[imageDataBuffersN-1],
            newpx = newdata.data,
            len = newpx.length;

        var MOTION_COLOR_THRESHOLD = 60,
            GRID_FACTOR = 4,
            MOTION_ALPHA_THRESHOLD = 120,
            alpha = 0,
            gamma = 3,
            i = l = x = y = 0,
            w = VIDEO_WIDTH = this.motionSensor.VIDEO_WIDTH,
            h = VIDEO_HEIGHT = this.motionSensor.VIDEO_HEIGHT;

        var k = this.motionSensor.options.totalClusters,
            clusters = [],
            points = [];

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
            if (this.i > imageDataBuffersN && (!(x % GRID_FACTOR) && !(y % GRID_FACTOR)) && alpha > MOTION_ALPHA_THRESHOLD) {
                //newpx[i+3] = parseInt(alpha, 10); // debug
                points.push(
                    new MotionSensor.Pixel(
                        new MotionSensor.Vector2(x, y),
                        new MotionSensor.Vector3(newpx[i+0], newpx[i+1], newpx[i+2])
                    )
                );
            }
        }


        // compute clusters
        clusters = MotionSensor.Cluster.upsertArrayFromPoints(this.clustersBuffer, points, k, this.motionSensor);

        // paint canvas with the latest camera frame
        ctx.putImageData(imageDataBuffers[imageDataBuffersN-1], 0, 0);


        for (var j = 0, k = clusters.length; j < k; j++) {
            var cluster = clusters[j];

            if (cluster.points.length < 3) { 
                continue;
            }

            // draw object hulls
            cluster.boundaryPointIndices = this.convexHull.getGrahamScanPointIndices(cluster.points);

            // compute cluster motion values
            if (cluster.boundaryPointIndices && cluster.boundaryPointIndices.length > 0) {

                /// <---
                var p, nx, ny, dx, dy, q, prevpx, c1, c2, cx = cy = countx = county = 0, maxpx = 30, pcounter = 0;

                for (i = 0, l = cluster.points.length; i < l; i++) {
                    x = cluster.points[i].x;
                    y = cluster.points[i].y;

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
                cluster.modulus *= (0.03 / this.motionSensor.scale);

                if (this.clustersBuffer[j]) { // ease centroid movement by using buffering
                    cluster.centroid.x = (cluster.centroid.x + this.clustersBuffer[j].centroid.x)*.5;
                    cluster.centroid.y = (cluster.centroid.y + this.clustersBuffer[j].centroid.y)*.5;
                }

                ///  --->
                this.clustersBuffer[j] = cluster; // update buffer
            }
        }


        this.motionSensor.trigger('processor:compute', [
            this.clustersBuffer,
            this.context,
            1
        ]);

        if (this.i > 30) {
            this.superPoints = this.clustersBuffer.map(function (c) {
                return new MotionSensor.Pixel(
                    new MotionSensor.Vector4(c.centroid.x, c.centroid.y, c.versor.x*c.modulus, c.versor.y*c.modulus),
                    new MotionSensor.Vector3(
                        Math.floor(c.rgbFloat.x),
                        Math.floor(c.rgbFloat.y),
                        Math.floor(c.rgbFloat.z)
                    )
                );
            });


            this.superClustersBuffer = MotionSensor.Cluster.upsertArrayFromPoints(this.superClustersBuffer, this.superPoints, 6, this.motionSensor, 2);

            var processor = this;
            this.superClustersBuffer.forEach(function (cluster) {
                cluster.boundaryPointIndices = processor.convexHull.getGrahamScanPointIndices(cluster.points);
            })

            this.motionSensor.trigger('processor:compute', [
                this.superClustersBuffer,
                this.context,
                2
            ]);
        }
    };

}(window, document));
