;(function (window, document) {

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

}(window, document));
