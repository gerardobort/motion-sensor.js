;(function (window, document) {

    var MotionSensor = function (options) {
        this.options = options;

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'motion-sensor';
        this.canvas.style.webkitTransform = 'scaleX(-1)'; // TODO redo: hack for mirroring

        this.video = document.createElement('video');
        this.video.autoplay = 'true';
        this.video.style.display = 'none';


        this.videoScale = this.options.videoScale || 1;
        this.VIDEO_WIDTH = this.videoScale*640;
        this.VIDEO_HEIGHT = this.videoScale*480;
        this.canvas.width = this.VIDEO_WIDTH;
        this.canvas.height = this.VIDEO_HEIGHT;
        this.video.width = this.VIDEO_WIDTH;
        this.video.height = this.VIDEO_HEIGHT;

        this.setScale(options.initialScale || .25);

        var body = document.getElementsByTagName('body')[0];
        body.appendChild(this.canvas);
        body.appendChild(this.video);

        this.canvasContext = this.canvas.getContext('2d');

        // initialize variables
        if (options.totalBuffers < 2) {
            throw 'MotionSensor: Wrong setting: totalBuffers must be 2 or higher.';
        } else if (options.totalBuffers < 3) {
            console.log('MotionSensor: Warning: It\'s not possible to compute cluster directions when using 2 buffers.');
        }
        this.imageDataBuffersN = options.totalBuffers;
        this.imageDataBuffers = [];
        for (var i = 0, l = this.imageDataBuffersN; i < l; i++) {
            this.imageDataBuffers.push(this.canvasContext.createImageData(this.VIDEO_WIDTH, this.VIDEO_HEIGHT));
        }

        this.attachedEvents = {};
        this.processorConstructor = options.processor || this.constructor.Processor;
        this.performanceController = new this.constructor.PerformanceController(this);
    };

    MotionSensor.prototype.start = function () {
        var instance = this;

        instance.processor = new instance.processorConstructor(instance);

        navigator.webkitGetUserMedia({ video: true },
            function (stream) {
                // replace with another video source if needed
                instance.video.src = webkitURL.createObjectURL(stream);
                webkitRequestAnimationFrame(instance.updateCanvas.bind(instance));
                console.log('MotionSensor started.');
                instance.trigger('start', [instance.canvas, instance.canvasContext])
            },
            function () {
                throw 'MotionSensor error during webcam initialization.';
            }
        );
    };

    MotionSensor.prototype.setScale = function (scale) {
        this.scale = scale;
    };

    MotionSensor.prototype.updateCanvas = function () {
        var instance = this;
        instance.canvasContext.drawImage(instance.video, 0, 0, this.VIDEO_WIDTH, this.VIDEO_HEIGHT);
        instance.originalImageData = instance.canvasContext.getImageData(0, 0, this.VIDEO_WIDTH, this.VIDEO_HEIGHT);

        // shift imageDataBuffers and store the last one
        for (var i = 0, l = instance.imageDataBuffersN-1; i < l; i++) {
            instance.imageDataBuffers[i] = instance.imageDataBuffers[i+1];
        }
        instance.imageDataBuffers[l] = instance.canvasContext.createImageData(this.VIDEO_WIDTH, this.VIDEO_HEIGHT);
        instance.imageDataBuffers[l].data.set(instance.originalImageData.data);

        instance.processor.processCircularBuffer(instance.originalImageData, instance.imageDataBuffers);

        instance.performanceController.setFrameMark();
        instance.performanceController.control();

        // do while 1
        webkitRequestAnimationFrame(instance.updateCanvas.bind(instance));
    };

    MotionSensor.prototype.on = function (eventName, handler) {
        if (!this.attachedEvents[eventName]) {
            this.attachedEvents[eventName] = [];
        }
        this.attachedEvents[eventName].push(handler);
    };

    MotionSensor.prototype.trigger = function (eventName, params) {
        if (!this.attachedEvents[eventName]) {
            return;
        }
        for (var i = 0; i < this.attachedEvents[eventName].length; i++) {
            if (false === this.attachedEvents[eventName][i].apply(params[0]||this, params)) {
                return;
            }
        }
    };

    window.MotionSensor = MotionSensor;

}(window, document));
;;(function (MotionSensor) {

    MotionSensor.Vector2 = function(x, y) {
        this.x = x;
        this.y = y;
    };

    MotionSensor.Vector2.prototype.getDistance = function(v2) {
        return Math.sqrt(Math.pow(this.x - v2.x, 2) + Math.pow(this.y - v2.y, 2));
    };


}(MotionSensor));
;;(function (MotionSensor) {

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
;;(function (MotionSensor) {

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
;;(function (MotionSensor) {

    MotionSensor.Pixel = function(v2Position, v3Color) {
        this.position = v2Position;
        this.color = v3Color;
    };

}(MotionSensor));
;;(function (MotionSensor) {

    MotionSensor.PerformanceController = function (motionSensor) {
        this.motionSensor = motionSensor;
        this.timeMarksN = 60;
        this.timeMarks = [0, 0, 0, 0, 0, 0];
        this.votes = 0;
        this.EXPECTED_FPS = 30;
        this.fpsByScale = {};
    };

    MotionSensor.PerformanceController.prototype.setFrameMark = function () {
        for (var i = 0, l = this.timeMarksN-1; i < l; i++) {
            this.timeMarks[i] = this.timeMarks[i+1];
        }
        this.timeMarks[this.timeMarksN-1] = Date.now();
    };

    MotionSensor.PerformanceController.prototype.getFPS = function () {
        var dFrame = 0;
        for (var i = 0, l = this.timeMarksN-1; i < l; i++) {
            dFrame += (this.timeMarks[i+1] - this.timeMarks[i])/1000/l;
        }
        fps = Math.floor(1/dFrame*100)/100;
        this.fpsByScale[this.motionSensor.scale.toString()] = fps;
        return fps;
    };

    MotionSensor.PerformanceController.prototype.control = function () {
        var fps = this.getFPS();
        fps < this.EXPECTED_FPS ? this.votes-- : this.votes++;
        this.motionSensor.trigger('fps:change', [fps, this.motionSensor.scale]);

        if (!this.motionSensor.options.fpsControlEnabled) {
            return;
        }

        var newScale;
        if (this.votes < -90) {
            newScale = this.motionSensor.scale - .25;
        } else if (this.votes > 90) {
            newScale = this.motionSensor.scale + .25;
        }
        if (newScale
            && !this.fpsByScale[newScale]
            || Math.abs(this.fpsByScale[newScale] - this.EXPECTED_FPS) 
                < Math.abs(this.fpsByScale[this.motionSensor.scale] - this.EXPECTED_FPS)
            ) {
            console.log('MotionSensor: switch to scale', newScale, ' - fps map', this.fpsByScale);
            this.motionSensor.setScale(newScale);
            this.votes = 0;
        }
    };

}(MotionSensor));
;;(function (MotionSensor) {


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
     * Implements basic K-means algorithm
     */
    MotionSensor.Cluster.upsertArrayFromPoints = function (previousClusters, points, K, motionSensor, level, w, h) {
        var k = K,
            p,
            dMin = d = 0,
            jMin = 0,
            clusters = [],
            step = 0,
            maxSteps = 3,
            maxDelta = 70,
            w = VIDEO_WIDTH = w || motionSensor.VIDEO_WIDTH,
            h = VIDEO_HEIGHT = h || motionSensor.VIDEO_HEIGHT;

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
if (points.length > 10) {
//console.log(points);
//throw 'xx';
}
            for (i = 0, l = points.length; i < l; i++) {
                p = points[i];
                if (!p) { continue; }
//console.log(p.position.x);
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

}(MotionSensor));
;;(function (MotionSensor) {

    var distance2 = function (v1, v2, i) {
        return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2));
    };

    var distance3 = function (v1, v2, i) {
        return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2) + Math.pow(v1[i+2] - v2[i+2], 2));
    };

    MotionSensor.Processor = function (motionSensor) {
        // IoC
        this.motionSensor = motionSensor;
        this.context = motionSensor.canvasContext;

        this.i = 0; // frame counter
        this.clustersBuffer = [];
        this.convexHull = new motionSensor.constructor.ConvexHull();
        this.superClustersBuffer = [];
    }

    MotionSensor.Processor.prototype.processCircularBuffer = function (originalImageData, imageDataBuffers) {
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
            if (this.i > imageDataBuffersN && (!(x % SAMPLING_GRID_FACTOR) && !(y % SAMPLING_GRID_FACTOR)) && alpha > MOTION_ALPHA_THRESHOLD) {
                if (this.motionSensor.options.debug) {
                    newpx[i+3] = parseInt(alpha, 10);
                }
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
                cluster.modulus *= (0.006 / Math.pow(this.motionSensor.scale,2));

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

    };

}(MotionSensor));
;;(function (MotionSensor) {

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

        var MOTION_COLOR_THRESHOLD = 50,
            SAMPLING_GRID_FACTOR = Math.floor(2/this.motionSensor.scale), // 2 - 8
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
            if (this.i > imageDataBuffersN && (!(x % SAMPLING_GRID_FACTOR) && !(y % SAMPLING_GRID_FACTOR)) && alpha > MOTION_ALPHA_THRESHOLD) {
                if (this.motionSensor.options.debug) {
                    newpx[i+3] = parseInt(alpha, 10);
                }
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
                cluster.modulus *= (0.006 / Math.pow(this.motionSensor.scale,2));

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


            this.superClustersBuffer = MotionSensor.Cluster.upsertArrayFromPoints(this.superClustersBuffer, this.superPoints, this.motionSensor.options.totalSuperCusters, this.motionSensor, 2);

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

}(MotionSensor));
;;(function (MotionSensor) {

    var distance2 = function (v1, v2, i) {
        return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2));
    };

    var distance3 = function (v1, v2, i) {
        return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2) + Math.pow(v1[i+2] - v2[i+2], 2));
    };

    MotionSensor.ProcessorHough = function (motionSensor) {
        // IoC
        this.motionSensor = motionSensor;
        this.context = motionSensor.canvasContext;

        this.i = 0; // frame counter
        this.clustersBuffer = [];
        this.convexHull = new motionSensor.constructor.ConvexHull();
        this.superClustersBuffer = [];


        this.numAngleCells = 360;
        this.rhoMax = Math.sqrt(motionSensor.VIDEO_WIDTH * motionSensor.VIDEO_WIDTH + motionSensor.VIDEO_HEIGHT * motionSensor.VIDEO_HEIGHT);
        this.accum = Array(this.numAngleCells);

        // Precalculate tables.
        this.cosTable = Array(this.numAngleCells);
        this.sinTable = Array(this.numAngleCells);
        for (var theta = 0, thetaIndex = 0; thetaIndex < this.numAngleCells; theta += Math.PI / this.numAngleCells, thetaIndex++) {
            this.cosTable[thetaIndex] = Math.cos(theta);
            this.sinTable[thetaIndex] = Math.sin(theta);
        }

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'hough-transform';
        this.canvas.style.background = 'rgba(0, 0, 0, 0.8)';
        this.canvas.style.border = '1px solid rgba(0, 255, 0, 0.5)';
        this.canvas.style.webkitTransform = 'scaleX(-1)'; // TODO redo: hack for mirroring
        this.canvas.width = this.numAngleCells;
        this.canvas.height = this.rhoMax/2;
        var body = document.getElementsByTagName('body')[0];
        body.appendChild(this.canvas);
        this.context = this.canvas.getContext('2d');
    }


    // Implementation with lookup tables.
    MotionSensor.ProcessorHough.prototype.houghAcc = function (x, y, r, g, b, newpx) {
        var rho;
        var thetaIndex = 0;
        var i, xdx, ydy;
        var w = motionSensor.VIDEO_WIDTH, h = motionSensor.VIDEO_HEIGHT;

        x -= w / 2;
        y -= h / 2;
        for (; thetaIndex < this.numAngleCells; thetaIndex++) {
            rho = this.rhoMax + x * this.cosTable[thetaIndex] + y * this.sinTable[thetaIndex];
            rho >>= 1;
            if (this.accum[thetaIndex] == undefined) this.accum[thetaIndex] = [];
            if (this.accum[thetaIndex][rho] == undefined) {
                this.accum[thetaIndex][rho] = 1;
            } else {
                this.accum[thetaIndex][rho]++;
            }

            xdx = Math.floor(thetaIndex);
            ydy = Math.floor(rho - this.rhoMax/4);
            i = (ydy*w + xdx)*4;
            
            //newpx[i  ] = r;
            //newpx[i+1] = g;
            //newpx[i+2] = b;
            newpx[i  ] = 0;
            newpx[i+1] = 255;
            newpx[i+2] = 0;
            newpx[i+3] += 10;
        }
    }

    MotionSensor.ProcessorHough.prototype.processCircularBuffer = function (originalImageData, imageDataBuffers) {
        this.i++;

        var imageDataBuffersN = imageDataBuffers.length;

        var ctx = this.motionSensor.canvasContext;
        var houghctx = this.context;

        var videodata = originalImageData,
            videopx = videodata.data,
            newdata = imageDataBuffers[imageDataBuffersN-1],
            newpx = newdata.data,
            len = newpx.length;

        var MOTION_COLOR_THRESHOLD = 50,
            SAMPLING_GRID_FACTOR = Math.floor(2/this.motionSensor.scale), // 2 - 8
            MOTION_ALPHA_THRESHOLD = 120,
            i = l = x = y = 0,
            w = VIDEO_WIDTH = this.motionSensor.VIDEO_WIDTH,
            h = VIDEO_HEIGHT = this.motionSensor.VIDEO_HEIGHT;

        var k = this.motionSensor.options.totalClusters,
            clusters = [],
            points = [];

        houghBufferPrevious = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
        houghBuffer = this.context.createImageData(w, h);
        houghpx = houghBuffer.data;

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

            //if (Math.random() < this.motionSensor.scale) {
                if (this.i > imageDataBuffersN && (!(x % SAMPLING_GRID_FACTOR) && !(y % SAMPLING_GRID_FACTOR)) && alpha > MOTION_ALPHA_THRESHOLD) {
                    this.houghAcc(x, y, newpx[i], newpx[i+1], newpx[i+2], houghpx);
                }
            //}
        }

        for (i = 0; i < houghpx.length; i += 4) {
            x = (i/4) % w;
            y = parseInt((i/4) / w);

            if ((!(x % SAMPLING_GRID_FACTOR) && !(y % SAMPLING_GRID_FACTOR)) && houghpx[i+3] > MOTION_ALPHA_THRESHOLD) {
                if (this.motionSensor.options.debug) {
                    houghpx[i] = 255;
                    houghpx[i+1] = 0;
                }
                points.push(
                    new MotionSensor.Pixel(
                        new MotionSensor.Vector2(x, y),
                        new MotionSensor.Vector3(0, 0, 0)
                    )
                );
            }
        }
        houghctx.putImageData(houghBuffer, 0, 0);
        clusters = MotionSensor.Cluster.upsertArrayFromPoints(this.clustersBuffer, points, k, this.motionSensor, 1, this.canvas.width, this.canvas.height);

        for (var j = 0, k = clusters.length; j < k; j++) {
            var cluster = clusters[j];
            if (cluster.points.length < 3) { 
                continue;
            }

            cluster.modulus = 1; // fake value
            cluster.versor.x = 1;
            cluster.versor.y = 0;

            if (this.clustersBuffer[j]) { // ease centroid movement by using buffering
                cluster.centroid.x = (cluster.centroid.x + this.clustersBuffer[j].centroid.x)*.5;
                cluster.centroid.y = (cluster.centroid.y + this.clustersBuffer[j].centroid.y)*.5;
            }

            this.clustersBuffer[j] = cluster; // update buffer
        }

        this.motionSensor.trigger('processor:compute', [
            this.clustersBuffer,
            this.context
        ]);
        this.clustersBuffer

    };

}(MotionSensor));
;;(function (MotionSensor) {

    MotionSensor.ConvexHull = function() {
    };

    MotionSensor.ConvexHull.prototype.getGrahamScanPointIndices = function (_points) {
        this.indices = [];
        if (_points.length < 3) {
            return;
        }
        this.points = _points;
            
        // Find the lowest point
        var min = 0;
        for (var i = 1; i < this.points.length; i++) {
            if (this.points[i].y == this.points[min].y) {
                if (this.points[i].x < this.points[min].x) {
                    min = i;
                }
            } else if (this.points[i].y < this.points[min].y) {
                min = i;
            }
        }
        
        // Calculate angle and distance from base
        var al = new Array();
        var ang = 0.0;
        var dist = 0.0;
        for (i = 0; i < this.points.length; i++) {
            if (i == min) {
                continue;
            }
            ang = this.angle(min, i);
            if (ang < 0) {
                ang += Math.PI;
            }
            dist = this.distance(min, i);
            al.push(new this.Point(i, ang, dist));
        }
        
        al.sort(function (a, b) { return a.compare(b); });
        
        // Create stack
        var stack = new Array(this.points.length + 1);
        var j = 2;
        for (i = 0; i < this.points.length; i++) {
            if (i == min) {
                continue;
            }
            stack[j] = al[j - 2].index;
            j++;
        }
        stack[0] = stack[this.points.length];
        stack[1] = min;
        
        var tmp;
        var M = 2;
        for (i = 3; i <= this.points.length; i++) {
            while (this.ccw(stack[M-1], stack[M], stack[i]) <= 0) {
                M--;
            }
            M++;
            tmp = stack[i];
            stack[i] = stack[M];
            stack[M] = tmp;
        }
        
        this.indices = new Array(M);
        for (i = 0; i < M; i++) {
            this.indices[i] = stack[i+1];
        }
        return this.indices;
    };

    MotionSensor.ConvexHull.prototype.ccw = function(p1, p2, p3) {
        if (!this.points[p1] || !this.points[p2] || !this.points[p3]) {
            return; // horrible bugfix
        }
        return (
            (this.points[p2].x - this.points[p1].x) * (this.points[p3].y - this.points[p1].y)
            - (this.points[p2].y - this.points[p1].y) * (this.points[p3].x - this.points[p1].x
        ));
    };
        
    MotionSensor.ConvexHull.prototype.angle = function (o, a) {
        return Math.atan(
            (this.points[a].y-this.points[o].y) / (this.points[a].x - this.points[o].x)
        );
    };
        
    MotionSensor.ConvexHull.prototype.distance = function (a, b) {
        return (
            (this.points[b].x-this.points[a].x) * (this.points[b].x-this.points[a].x)
            + (this.points[b].y-this.points[a].y) * (this.points[b].y-this.points[a].y)
        );
    };

    MotionSensor.ConvexHull.prototype.Point = function(i, a, d) {
        this.index = i;
        this.angle = a;
        this.distance = d;
        
        this.compare = function (p) {
            if (this.angle < p.angle) {
                return -1;
            } else if (this.angle > p.angle) {
                return 1;
            } else if (this.distance < p.distance) {
                return -1;
            } else if (this.distance > p.distance) {
                return 1;
            }
            return 0;
        }
    }

}(MotionSensor));
