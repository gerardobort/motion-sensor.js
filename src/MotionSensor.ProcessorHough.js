;(function (MotionSensor) {

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
                    //houghpx[i] = 255;
                    //houghpx[i+1] = 0;
                }
                points.push(
                    new MotionSensor.Pixel(
                        new MotionSensor.Vector2(x, y),
                        new MotionSensor.Vector3(houghpx[i], houghpx[i+1], houghpx[i+2])
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

            var rho = cluster.centroid.y;
            var theta = Math.floor(cluster.centroid.x);

            var ox = w/2 + (rho - (h/2)*this.sinTable[theta])/this.cosTable[theta];
            var oy = h/2 + (rho - (w/2)*this.cosTable[theta])/this.sinTable[theta];

            cluster.p1 = new MotionSensor.Vector2(ox-rho*this.cosTable[theta], oy-rho*this.sinTable[theta]);
            cluster.p2 = new MotionSensor.Vector2(ox, oy);

            this.clustersBuffer[j] = cluster; // update buffer
        }

        this.motionSensor.trigger('processor:compute:hough', [
            this.clustersBuffer,
            this.context
        ]);

        this.motionSensor.trigger('processor:compute', [
            this.clustersBuffer,
            this.motionSensor.canvasContext
        ]);


    };

}(MotionSensor));
