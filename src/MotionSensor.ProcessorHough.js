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
        //this.canvas.style.webkitTransform = 'scaleX(-1)'; // TODO redo: hack for mirroring
        this.canvas.width = this.numAngleCells;
        this.canvas.height = this.rhoMax;
        var body = document.getElementsByTagName('body')[0];
        body.appendChild(this.canvas);
        this.context = this.canvas.getContext('2d');

        var instance = this;
        if (motionSensor.options.debug) {
            motionSensor.canvas.addEventListener('mousemove', function (e) {
                instance.mouseX = e.layerX,
                instance.mouseY = e.layerY;
            });
            instance.canvas.addEventListener('mousemove', function (e) {
                instance.houghMouseX = e.layerX,
                instance.houghMouseY = e.layerY;
            });
            motionSensor.canvas.addEventListener('mouseout', function (e) {
                instance.mouseX = motionSensor.VIDEO_WIDTH/2,
                instance.mouseY = motionSensor.VIDEO_HEIGHT/2;
            });
            instance.canvas.addEventListener('mouseout', function (e) {
                instance.houghMouseX = instance.numAngleCells/2,
                instance.houghMouseY = instance.rhoMax/2;
            });
        }
    }


    // Implementation with lookup tables.
    MotionSensor.ProcessorHough.prototype.houghAcc = function (x, y, r, g, b, alphaInc, newpx) {
        var rho;
        var thetaIndex = 0;
        var i, xdx, ydy;
        var w = this.numAngleCells, h = this.rhoMax;

        //x -= w / 2;
        //y -= h / 2;
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
            ydy = Math.floor(rho);
            i = (ydy*w + xdx)*4;
            
            if (
                0 <= xdx && xdx <= this.numAngleCells
                && 0 <= ydy && ydy <= this.rhoMax
                ) {
                // newpx[i  ] = r;
                // newpx[i+1] = g;
                // newpx[i+2] = b;
                newpx[i  ] = 0;
                newpx[i+1] = 255;
                newpx[i+2] = 0;
                newpx[i+3] += alphaInc;
            }
        }
    }

    // idea based on: http://liquify.eu/project/HoughTransform/
    // math calculus taken from: https://github.com/yume190/TenSha/blob/756acdf0d9562525350578eb7603f7fae63abe30/Q1/tool/OpenCV2-Python-master/Official_Tutorial_Python_Codes/3_imgproc/houghlines.py
    MotionSensor.ProcessorHough.prototype.houghLine = function (rho, theta) {

            rho = rho - this.rhoMax/2;
            var thetaIndex = Math.floor(theta);

            var a = this.cosTable[thetaIndex];
            var b = this.sinTable[thetaIndex];
            
            var x0 = 2*a*rho;
            var y0 = 2*b*rho;

            var x1 = x0 + 1000*-b;
            var y1 = y0 + 1000* a;
            var x2 = x0 - 1000*-b;
            var y2 = y0 - 1000* a;

            return [
                new MotionSensor.Vector2(x1, y1),
                new MotionSensor.Vector2(x2, y2),
                new MotionSensor.Vector2(x0, y0)
            ];
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

        //houghBufferPrevious = houghctx.getImageData(0, 0, this.numAngleCells, this.rhoMax);
        houghBuffer = houghctx.createImageData(this.numAngleCells, this.rhoMax);
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
                    this.houghAcc(x, y, newpx[i], newpx[i+1], newpx[i+2], 10, houghpx);
                }
            //}

            if (this.motionSensor.testImage && newpx[i] < 80) {
                newpx[i] = newpx[i+1] = newpx[i+2] = 100;
                newpx[i+1] = 200;
                this.houghAcc(x, y, newpx[i], newpx[i+1], newpx[i+2], 1, houghpx);
            }

        }

        for (i = 0; i < houghpx.length; i += 4) {
            x = (i/4) % this.numAngleCells;
            y = parseInt((i/4) / this.numAngleCells);

            if ((!(x % SAMPLING_GRID_FACTOR) && !(y % SAMPLING_GRID_FACTOR)) && houghpx[i+3] > MOTION_ALPHA_THRESHOLD) {
                points.push(
                    new MotionSensor.Pixel(
                        new MotionSensor.Vector2(x, y),
                        new MotionSensor.Vector3(houghpx[i], houghpx[i+1], houghpx[i+2])
                    )
                );
            }
        }

        ctx.putImageData(newdata, 0, 0);

        if (this.motionSensor.options.debug) {
            // video canvas mark
            ctx.beginPath();
            ctx.fillStyle = '#f00';
            ctx.fillRect(w - this.mouseX - 2, this.mouseY - 2, 4, 4);
            ctx.closePath();
            // hough canvas line
            this.houghAcc(w - this.mouseX, this.mouseY, 255, 0, 0, 100, houghpx);
        }

        houghctx.putImageData(houghBuffer, 0, 0);

        if (this.motionSensor.options.debug) {
            // hough canvas mark
            houghctx.beginPath();
            houghctx.fillStyle = '#f00';
            houghctx.fillRect(this.houghMouseX - 2, this.houghMouseY - 2, 4, 4);
            houghctx.closePath();
            // video canvas line

            var linePoints = this.houghLine(this.houghMouseY, this.houghMouseX);

            ctx.beginPath();
            ctx.moveTo(linePoints[0].x, linePoints[0].y);
            ctx.lineTo(linePoints[1].x, linePoints[1].y);
            ctx.closePath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#f00';
            ctx.stroke();
            ctx.fillStyle = '#000';
            ctx.fillRect((linePoints[2].x - 2), linePoints[2].y - 2, 4, 4);
        }



        clusters = MotionSensor.Cluster.upsertArrayFromPoints(this.clustersBuffer, points, k, this.motionSensor, 1, this.numAngleCells, this.rhoMax);

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

            var clusterLinePoints = this.houghLine(cluster.centroid.y||0, cluster.centroid.x||0); 
            cluster.p1 = clusterLinePoints[0];
            cluster.p2 = clusterLinePoints[1];


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
