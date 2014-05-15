;(function (window, document) {

    var distance2 = function (v1, v2, i) {
        return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2));
    };

    var distance3 = function (v1, v2, i) {
        return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2) + Math.pow(v1[i+2] - v2[i+2], 2));
    };

    MotionSensor.prototype.Processor = function (motionSensor) {
        // IoC
        this.motionSensor = motionSensor;
        this.context = motionSensor.canvasContext;

        this.i = 0; // frame counter
        this.randomPointColors = [];
        var r, g, b;
        for (var i = 0; i < 100; i++) {
            r = Math.floor(Math.random()*255);
            g = Math.floor(Math.random()*255);
            b = Math.floor(Math.random()*255);
            this.randomPointColors.push('rgba(' + r + ', ' + g + ', ' + b + ', 0.6)');
        }
        this.clustersBuffer = [];
        this.convexHull = new this.ConvexHull();
    }

    MotionSensor.prototype.Processor.prototype.processCircularBuffer = function (originalImageData, imageDataBuffers) {
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
            p = O = P = null,
            dMin = d = 0,
            jMin = 0,
            points = [],
            clusters = [],
            step = 0,
            maxSteps = 3,
            maxDelta = 70;

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

        // remember buffered object coordinates
        var cluster;
        for (j = 0; j < k; j++) {
            cluster = this.clustersBuffer[j];
            if (cluster) {
                var centroidPixel = new MotionSensor.Pixel(cluster.centroid, cluster.rgbFloat);
                // ensure we have at leaset three points initially
                points = points.concat([centroidPixel, centroidPixel, centroidPixel]);//, cluster.boundaryPointIndices.map(function (i) { return cluster.pixels[i]; }));
            }
        }

        ctx.putImageData(imageDataBuffers[imageDataBuffersN-1], 0, 0);

        // PAM algorythm (k-Means clustering)
        for (step = 0; step < maxSteps; step++) {
            for (j = 0; j < k; j++) {
                if (0 === step) {
                    if (!this.clustersBuffer[j]) {
                        x = parseInt(Math.random()*VIDEO_WIDTH, 10);
                        y = parseInt(Math.random()*VIDEO_HEIGHT, 10);
                        clusters.push(new MotionSensor.Cluster(
                            j,
                            [x, y],
                            [1, 0],
                            0,
                            [],
                            [],
                            [],
                            [0,0],
                            [0,0,0],
                            this.randomPointColors[j]
                        ));
                    } else {
                        clusters.push(this.clustersBuffer[j]);
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

        for (var j = 0; j < k; j++) {
            var cluster = clusters[j];

            if (cluster.points.length < 3) { 
                continue;
            }

            // draw object hulls
            cluster.boundaryPointIndices = this.convexHull.getGrahamScanPointIndices(cluster.points);
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

            this.motionSensor.trigger('cluster:change', [
                cluster,
                this.context
            ]);
        }
    };

}(window, document));
