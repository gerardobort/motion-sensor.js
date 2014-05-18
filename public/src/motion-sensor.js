;(function (window, document) {

    var distance2 = function (v1, v2, i) {
        return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2));
    };

    var distance3 = function (v1, v2, i) {
        return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2) + Math.pow(v1[i+2] - v2[i+2], 2));
    };

    var MotionSensor = function (options) {
        this.options = options;

        this.VIDEO_WIDTH = .5*320;
        this.VIDEO_HEIGHT = .5*240;

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.VIDEO_WIDTH;
        this.canvas.height = this.VIDEO_HEIGHT;
        this.canvas.style.webkitTransform = 'scaleX(-1)'; // TODO redo: hack for mirroring

        this.video = document.createElement('video');
        this.video.width = this.VIDEO_WIDTH;
        this.video.height = this.VIDEO_HEIGHT;
        this.video.autoplay = 'true';
        this.video.style.display = 'none';

        var body = document.getElementsByTagName('body')[0];
        body.appendChild(this.canvas);
        body.appendChild(this.video);

        this.canvasContext = this.canvas.getContext('2d');

        // initialize variables
        if (options.totalBuffers < 3) {
            throw 'MotionSensor: Wrong setting: totalBuffers must be 3 or higher.';
        }
        this.imageDataBuffersN = options.totalBuffers;
        this.imageDataBuffers = [];
        for (var i = 0, l = this.imageDataBuffersN; i < l; i++) {
            this.imageDataBuffers.push(this.canvasContext.createImageData(this.VIDEO_WIDTH, this.VIDEO_HEIGHT));
        }

        this.attachedEvents = {};
    };

    MotionSensor.prototype.start = function () {
        var instance = this;

        instance.processor = new instance.Processor(instance);

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
        //instance.canvasContext.putImageData(instance.imageDataBuffers[l], 0, 0);

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
            p = o = null,
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
                newpx[i+3] = parseInt(alpha, 10); // debug
                points.push([x, y, [ newpx[i+0], newpx[i+1], newpx[i+2] ]]);
            }
        }

        // remember buffered object coordinates
        for (j = 0; j < k; j++) {
            if (this.clustersBuffer[j]) {
                points.push([
                    this.clustersBuffer[j].centroid[0],
                    this.clustersBuffer[j].centroid[1],
                    this.clustersBuffer[j].rgbFloat]
                );
            }
        }


        // set a k value dinamically based on the amount of moving points in the canvas
        //k = parseInt((points.length*600)/(VIDEO_WIDTH*VIDEO_HEIGHT)/(GRID_FACTOR*GRID_FACTOR), 10);
        //if (k === 0) k = 1;
        //if (k > 3) k = 3;

        ctx.putImageData(imageDataBuffers[imageDataBuffersN-1], 0, 0);

        // PAM algorythm (k-Means clustering)
        for (step = 0; step < maxSteps; step++) {
            for (j = 0; j < k; j++) {
                if (0 === step) {
                    if (!this.clustersBuffer[j]) {
                        x = parseInt(Math.random()*VIDEO_WIDTH, 10);
                        y = parseInt(Math.random()*VIDEO_HEIGHT, 10);
                        //clusters.push([x, y, [], [], 0, 0, [0, 0, 0], true, [1, 0]]); // x, y, innerPointsVec, innerPointsObj, mx, my, rgbFloatColor, visible, versor
                        clusters.push({
                            centroid: [x, y],
                            innerPoints: [],
                            acum: [0, 0],
                            rgbFloat: [0, 0, 0],
                            visible: true,
                            versor: [1, 0]
                        });
                    } else {
                        clusters.push(this.clustersBuffer[j]);
                    }
                } else {
                    // re-assign cluster x,y
                    clusters[j].centroid = [
                        clusters[j].acum[0]/clusters[j].innerPoints.length,
                        clusters[j].acum[1]/clusters[j].innerPoints.length,
                    ];
                    clusters[j].innerPoints = [];
                    clusters[j].acum = [0, 0];
                    clusters[j].rgbFloat = [0, 0, 0];
                    clusters[j].visible = true;
                    clusters[j].versor = [1, 0];
                }
            }

            for (i = 0, l = points.length; i < l; i++) {
                p = points[i];
                dMin = Number.MAX_VALUE;
                jMin = 0;
                for (j = 0; j < k; j++) {
                    o = clusters[j].centroid;
                    if ((d = distance2(p, o, 0)) < dMin) {
                        dMin = d;
                        jMin = j;
                    }
                }
                if ((step !== maxSteps-1 || dMin < maxDelta) && clusters[jMin]) {
                    clusters[jMin].innerPoints.push(p);
                    clusters[jMin].acum[0] += p[0];
                    clusters[jMin].acum[1] += p[1];
                } else if (step < maxSteps) {
                    // means color
                    clusters[jMin].rgbFloat[0] += p[2][0]/l;
                    clusters[jMin].rgbFloat[1] += p[2][1]/l;
                    clusters[jMin].rgbFloat[2] += p[2][2]/l;
                }
            }
        }

        for (var j = 0; j < k; j++) {
            var rpoints = clusters[j].innerPoints;
            if (rpoints.length < 14/GRID_FACTOR) {
                clusters[j].visible = false;
                //continue;
            }
            clusters[j].visible = true;

            // draw object hulls
            var boundaryPointIndices = this.convexHull.getGrahamScanPointIndices(rpoints);
            if (boundaryPointIndices && boundaryPointIndices.length > 0) {

                /// <---
                var p, nx, ny, dx, dy, q, prevpx, c1, c2, cx = cy = countx = county = 0, maxpx = 30, modulus, versor, pcounter = 0;

                for (i = 0, l = rpoints.length; i < l; i++) {
                    x = rpoints[i][0];
                    y = rpoints[i][1];

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

                modulus = Math.sqrt(countx*countx + county*county);
                versor = [-countx/modulus, -county/modulus];
                clusters[j].versor = versor;

                var centroid = clusters[j].centroid;
                if (this.clustersBuffer[j]) { // ease centroid movement by using buffering
                    centroid = [
                        (clusters[j].centroid[0] + this.clustersBuffer[j].centroid[0])*0.5,
                        (clusters[j].centroid[1] + this.clustersBuffer[j].centroid[1])*0.5
                    ];
                }
            
                this.motionSensor.trigger('cluster:change', [
                    new MotionSensor.Cluster(
                        j, centroid, versor, modulus * 0.02 * (GRID_FACTOR/4), 
                        rpoints, boundaryPointIndices, this.randomPointColors[j]
                    ),
                    this.context
                ]);

                ///  --->
                this.clustersBuffer[j] = clusters[j]; // update buffer

            }
        }
    };

    MotionSensor.Vector2 = function(x, y) {
        this.x = x;
        this.y = y;
    };

    MotionSensor.Vector3 = function(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    };

    MotionSensor.Pixel = function(v2Position, v3Color) {
        this.position = v2Position;
        this.color = v3Color;
    };

    MotionSensor.Cluster = function(id, centroid, versor, modulus, points, boundaryPointIndices, debugColor) {
        this.id = id;
        this.centroid = new MotionSensor.Vector2(centroid[0], centroid[1]);
        this.versor = new MotionSensor.Vector2(versor[0], versor[1]);
        this.modulus = modulus;
        this.points = points.map(function (point) { return new MotionSensor.Vector2(point[0], point[1]); });
        this.boundaryPointIndices = boundaryPointIndices;
        this.debugColor = debugColor;
    };

    MotionSensor.prototype.Processor.prototype.ConvexHull = function() {
        this.ccw = function(p1, p2, p3) {
            if (!this.points[p1] || !this.points[p2] || !this.points[p3]) {
                return; // horrible bugfix
            }
            return (
                (this.points[p2][0] - this.points[p1][0]) * (this.points[p3][1] - this.points[p1][1])
                - (this.points[p2][1] - this.points[p1][1]) * (this.points[p3][0] - this.points[p1][0]
            ));
        }
        
        this.angle = function (o, a) {
            return Math.atan(
                (this.points[a][1]-this.points[o][1]) / (this.points[a][0] - this.points[o][0])
            );
        }
        
        this.distance = function (a, b) {
            return (
                (this.points[b][0]-this.points[a][0]) * (this.points[b][0]-this.points[a][0])
                + (this.points[b][1]-this.points[a][1]) * (this.points[b][1]-this.points[a][1])
            );
        }
        
        this.getGrahamScanPointIndices = function (_points) {
            this.indices = [];
            if (_points.length < 3) {
                return _points;
            }
            this.points = _points;
                
            // Find the lowest point
            var min = 0;
            for (var i = 1; i < this.points.length; i++) {
                if (this.points[i][1] == this.points[min][1]) {
                    if (this.points[i][0] < this.points[min][0]) {
                        min = i;
                    }
                } else if (this.points[i][1] < this.points[min][1]) {
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
        }
    }

    MotionSensor.prototype.Processor.prototype.ConvexHull.prototype.Point = function(i, a, d) {
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

    window.MotionSensor = MotionSensor;

}(window, document));
