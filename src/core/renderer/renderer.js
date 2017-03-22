
//! maximum allowed projected texel size (affects LOD selection, i.e., display
//! quality, and also control constraints)
Melown.resolutionThreshold_ = 1.1;
Melown.texelSizeFactor_ = 1.0;
Melown.noTextures_ = false;

Melown.StencilLineState_ = null;

/**
 * @constructor
 */
Melown.Renderer = function(core_, div_, onUpdate_, onResize_, config_) {
    this.config_ = config_ || {};
    //this.setConfigParams(config_);
    this.core_ = core_;
    this.progTile_ = null;
    this.progHeightmap_ = null;
    this.progSkydome_ = null;
    this.progWireframeTile_ = null;
    this.progWireframeTile2_ = null;
    this.progText_ = null;
    this.div_ = div_;
    this.onUpdate_ = onUpdate_;
    this.killed_ = false;
    this.onlyDepth_ = false;
    this.onlyLayers_ = false;
    this.onlyHitLayers_ = false;
    this.renderCounter_ = 1;
    this.hitmapCounter_ = 0;
    this.geoHitmapCounter_ = 0;
    this.clearStencilPasses_ = [];
    this.onResizeCall_ = onResize_;
    this.math_ = Melown.Math;

    this.touchSurfaceEvent_ = [];

    var rect_ = this.div_.getBoundingClientRect();

    this.winSize_ = [rect_.width, rect_.height]; //QSize
    this.curSize_ = [rect_.width, rect_.height]; //QSize
    this.oldSize_ = [rect_.width, rect_.height]; //QSize
    this.dirty_ = true;
    this.cameraVector_ = [0,1,0];
    //this.texelSizeLimit_ = this.core_.mapConfig_.texelSize_ * Melown.texelSizeFactor_;

    this.gpu_ = new Melown.GpuDevice(div_, this.curSize_, this.config_.rendererAllowScreenshots_, this.config_.rendererAntialiasing_);

    this.camera_ = new Melown.Camera(this, 45, 2, 1200000.0);

    //reduce garbage collection
    this.drawTileMatrix_ = Melown.mat4.create();
    this.drawTileMatrix2_ = Melown.mat4.create();
    this.drawTileVec_ = [0,0,0];
    this.drawTileWorldMatrix_ = Melown.mat4.create();
    this.pixelTileSizeMatrix_ = Melown.mat4.create();

    this.heightmapMesh_ = null;
    this.heightmapTexture_ = null;

    this.skydomeMesh_ = null;
    this.skydomeTexture_ = null;

    this.hitmapTexture_ = null;
    this.geoHitmapTexture_ = null;
    this.hitmapSize_ = 1024;
    this.updateHitmap_ = true;
    this.updateGeoHitmap_ = true;

    this.redTexture_ = null;

    this.rectVerticesBuffer_ = null;
    this.rectIndicesBuffer_ = null;
    this.imageProjectionMatrix_ = null;

    this.font_ = null;
    this.fogDensity_ = 0;

    this.jobZBuffer_ = new Array(512);
    this.jobZBufferSize_ = new Array(512);
    
    for (var i = 0, li = this.jobZBuffer_.length; i < li; i++) {
        this.jobZBuffer_[i] = [];
        this.jobZBufferSize_[i] = 0;
    }
    
    this.layerGroupVisible_ = [];
    this.bitmaps_ = {};
    
    this.cameraPosition_ = [0,0,0];
    this.cameraOrientation_ = [0,0,0];
    this.cameraTiltFator_ = 1;
    this.distanceFactor_ = 1;
    this.tiltFactor_ = 1;
    this.cameraVector_ = [0,0,0];
    this.labelVector_ = [0,0,0];

            
    //hack for melown maps
    //this.melownHack_ = true;
    //this.melownHack_ = false;

    //reduce garbage collection
    this.updateCameraMatrix_ = Melown.mat4.create();

    //debug
    this.lastHitPosition_ = [0,0,100];
    this.logTilePos_ = null;

    window.addEventListener("resize", (this.onResize).bind(this), false);

    this.initializeGL();

    if (window["MelownMobile_"] == true && this.gpu_.canvas_ != null) {
        this.gpu_.canvas_.style.width = "100%";
        this.gpu_.canvas_.style.height = "100%";
    }

    var factor_ = window["MelownScreenScaleFactor_"];
    this.resizeGL(Math.floor(this.curSize_[0]*factor_), Math.floor(this.curSize_[1]*factor_));

    //this.planet_ = new Melown.Planet(this);
    //this.planet_.addTiledTerrainLayer("terrain");
};

Melown.Renderer.prototype.onResize = function() {
    if (this.killed_ == true){
        return;
    }

    var rect_ = this.div_.getBoundingClientRect();
    //var factor_ = window["MelownScreenScaleFactor_"];
    this.resizeGL(Math.floor(rect_.width), Math.floor(rect_.height));
    
    if (this.onResizeCall_) {
        this.onResizeCall_();
    }
};

Melown.Renderer.prototype.kill = function() {
    if (this.killed_ == true){
        return;
    }

    this.killed_ = true;

    if (this.planet_ != null) {
        this.planet_.kill();
    }

    //this.gpuCache_.reset();

    if (this.heightmapMesh_) this.heightmapMesh_.kill();
    if (this.heightmapTexture_) this.heightmapTexture_.kill();
    if (this.skydomeMesh_) this.skydomeMesh_.kill();
    if (this.skydomeTexture_) this.skydomeTexture_.kill();
    if (this.hitmapTexture_) this.hitmapTexture_.kill();
    if (this.geoHitmapTexture_) this.geoHitmapTexture_.kill();
    if (this.redTexture_) this.redTexture_.kill();
    if (this.whiteTexture_) this.whiteTexture_.kill();
    if (this.blackTexture_) this.blackTexture_.kill();
    if (this.lineTexture_) this.lineTexture_.kill();
    if (this.textTexture2_) this.textTexture2_.kill();
    if (this.atmoMesh_) this.atmoMesh_.kill();
    if (this.bboxMesh_) this.bboxMesh_.kill();
    if (this.font_) this.font_.kill();
    if (this.plines_) this.plines_.kill();
    if (this.plineJoints_) this.plineJoints_.kill();
 
    this.gpu_.kill();
    //this.div_.removeChild(this.gpu_.getCanvas());
};


Melown.Renderer.prototype.getPlanet = function() {
    return this.planet_;
};

Melown.Renderer.prototype.resizeGL = function(width_, height_, skipCanvas_, skipPaint_) {
    this.camera_.setAspect(width_ / height_);
    this.curSize_ = [width_, height_];
    this.oldSize_ = [width_, height_];
    this.gpu_.resize(this.curSize_, skipCanvas_);

    if (skipPaint_ != true) {
        this.paintGL();
    }

    var m = [];
    m[0] = 2.0/width_; m[1] = 0; m[2] = 0; m[3] = 0;
    m[4] = 0; m[5] = -2.0/height_; m[6] = 0; m[7] = 0;
    m[8] = 0; m[9] = 0; m[10] = 1; m[11] = 0;
    m[12] = -width_*0.5*m[0]; m[13] = -height_*0.5*m[5]; m[14] = 0; m[15] = 1;

    this.imageProjectionMatrix_ = m;
};

Melown.Renderer.prototype.project2 = function(point_, mvp_) {
    var p_ = [point_[0], point_[1], point_[2], 1 ];

    //project point coords to screen
    var p2_ = [0, 0, 0, 1];
    p2_ = Melown.mat4.multiplyVec4(mvp_, p_);

    if (p2_[3] != 0) {
        var sp_ = [0,0,0];

        //x and y are in screen pixels
        sp_[0] = ((p2_[0]/p2_[3])+1.0)*0.5*this.curSize_[0];
        sp_[1] = (-(p2_[1]/p2_[3])+1.0)*0.5*this.curSize_[1];

        //depth in meters
        sp_[2] = p2_[2]/p2_[3];
        //sp_[2] = p2_[2];
        //sp_[2] =  this.camera_.getNear() + sp_[2] ;//* (this.camera_.getFar() - this.camera_.getNear());

        return sp_;
    } else {
        return [0, 0, 0];
    }
};


Melown.Renderer.prototype.project = function(point_, mvp_) {
    //get mode-view-projection matrix
    var mvp_ = this.camera_.getMvpMatrix();

    //get camera position relative to position
    var cameraPos2_ = this.camera_.getPosition();

    //get global camera position
    var cameraPos_ = this.cameraPosition();

    //get point coords relative to camera
    var p_ = [point_[0] - cameraPos_[0] + cameraPos2_[0], point_[1] - cameraPos_[1] + cameraPos2_[1], point_[2] - cameraPos_[2] + cameraPos2_[2], 1 ];

    //project point coords to screen
    var p2_ = [0, 0, 0, 1];
    p2_ = Melown.mat4.multiplyVec4(mvp_, p_);

    if (p2_[3] != 0) {

        var sp_ = [0,0,0];

        //x and y are in screen pixels
        sp_[0] = ((p2_[0]/p2_[3])+1.0)*0.5*this.curSize_[0];
        sp_[1] = (-(p2_[1]/p2_[3])+1.0)*0.5*this.curSize_[1];

        //depth in meters
        sp_[2] = p2_[2]/p2_[3];
        //sp_[2] = p2_[2];
        //sp_[2] =  this.camera_.getNear() + sp_[2] ;//* (this.camera_.getFar() - this.camera_.getNear());

        return sp_;
    } else {
        return [0, 0, 0];
    }
};


Melown.Renderer.prototype.getScreenRay = function(screenX_, screenY_) {
    if (this.camera_ == null) {
        return [0,0,1.0];
    }

    //conver screen coords
    var x_ = (2.0 * screenX_) / this.curSize_[0] - 1.0;
    var y_ = 1.0 - (2.0 * screenY_) / this.curSize_[1];
    
    //console.log("x: " + x_ + " y: " + y_);

    var rayNormalizeDeviceSpace_ = [x_, y_, 1.0];

    var rayClipCoords_ = [rayNormalizeDeviceSpace_[0], rayNormalizeDeviceSpace_[1], -1.0, 1.0];

    var invProjection_ = Melown.mat4.create();
    invProjection_ = Melown.mat4.inverse(this.camera_.getProjectionMatrix());

    var rayEye_ = [0,0,0,0];
    Melown.mat4.multiplyVec4(invProjection_, rayClipCoords_, rayEye_); //inverse (projection_matrix) * rayClipCoords_;
    rayEye_[2] = -1.0;
    rayEye_[3] = 0.0;

    var invView_ = Melown.mat4.create();
    invView_ = Melown.mat4.inverse(this.camera_.getModelviewMatrix());

    var rayWorld_ = [0,0,0,0];
    Melown.mat4.multiplyVec4(invView_, rayEye_, rayWorld_); //inverse (projection_matrix) * rayClipCoords_;

    // don't forget to normalise the vector at some point
    rayWorld_ = Melown.vec3.normalize([rayWorld_[0], rayWorld_[1], rayWorld_[2]]); //normalise (ray_wor);

    return rayWorld_;
};


Melown.Renderer.prototype.hitTestGeoLayers = function(screenX_, screenY_, mode_) {
    var gl_ = this.gpu_.gl_;

    //conver screen coords to texture coords
    if (gl_.checkFramebufferStatus(gl_.FRAMEBUFFER) != gl_.FRAMEBUFFER_COMPLETE) {
        //return [null, false, []];
        return [false, 0,0,0,0];
    }

    var surfaceHit_ = false;

    if (screenX_ >= 0 && screenX_ < this.curSize_[0] &&
        screenY_ >= 0 && screenY_ < this.curSize_[1]) {

        var x_ = 0, y_ = 0;

        //get screen coords
        x_ = Math.floor(screenX_ * (this.hitmapSize_ / this.curSize_[0]));
        y_ = Math.floor(screenY_ * (this.hitmapSize_ / this.curSize_[1]));

        //get pixel value from framebuffer
        var pixel_ = this.geoHitmapTexture_.readFramebufferPixels(x_, this.hitmapSize_ - y_ - 1, 1, 1);

        //convert rgb values into depth
        var id_ = (pixel_[0]) + (pixel_[1]<<8) + (pixel_[2]<<16);// + (pixel_[3]*16581375.0);

        var surfaceHit_ = !(pixel_[0] == 255 && pixel_[1] == 255 && pixel_[2] == 255 && pixel_[3] == 255);

    //    console.log(JSON.stringify([pixel_[0], pixel_[1], pixel_[2], pixel_[3], surfaceHit_]));

    }

    if (surfaceHit_) {
        return [true, pixel_[0], pixel_[1], pixel_[2], pixel_[3]];
    } 

    return [false, 0,0,0,0];
};

Melown.Renderer.prototype.switchToFramebuffer = function(type_) {
    var gl_ = this.gpu_.gl_;
    
    switch(type_) {
        case "base":
            var width_ = this.oldSize_[0];
            var height_ = this.oldSize_[1];
    
            gl_.clearColor(0.0, 0.0, 0.0, 1.0);
    
            this.gpu_.setFramebuffer(null);
    
            this.camera_.setAspect(width_ / height_);
            this.curSize_ = [width_, height_];
            this.gpu_.resize(this.curSize_, true);
            this.camera_.update();
            //this.updateCamera();
            this.onlyDepth_ = false;
            this.onlyHitLayers_ = false;
            break;

        case "depth":
            //set texture framebuffer
            this.gpu_.setFramebuffer(this.hitmapTexture_);

            this.oldSize_ = [ this.curSize_[0], this.curSize_[1] ];
   
            gl_.clearColor(1.0,1.0, 1.0, 1.0);
            gl_.enable(gl_.DEPTH_TEST);

            var size_ = this.hitmapSize_;
    
            //clear screen
            gl_.viewport(0, 0, size_, size_);
            gl_.clear(gl_.COLOR_BUFFER_BIT | gl_.DEPTH_BUFFER_BIT);
    
            this.curSize_ = [size_, size_];
            //this.gpu_.resize(this.curSize_, true);

            //var width_ = this.oldSize_[0];
            //var height_ = this.oldSize_[1];
            //this.camera_.setAspect(width_ / height_);

            this.gpu_.clear();
            //this.camera_.setAspect(2.5);
            this.camera_.update();
            this.onlyDepth_ = true;
            this.onlyHitLayers_ = false;
            break;

        case "geo":
            
            this.hoverFeatureCounter_ = 0;
            
            var size_ = this.hitmapSize_;
            
            //set texture framebuffer
            this.gpu_.setFramebuffer(this.geoHitmapTexture_);
            
            var oldSize_ = [ this.curSize_[0], this.curSize_[1] ];
            
            var width_ = size_;
            var height_ = size_;
            
            gl_.clearColor(1.0,1.0, 1.0, 1.0);
            gl_.enable(gl_.DEPTH_TEST);
            
            //clear screen
            gl_.viewport(0, 0, size_, size_);
            gl_.clear(gl_.COLOR_BUFFER_BIT | gl_.DEPTH_BUFFER_BIT);
            
            this.curSize_ = [width_, height_];
            
            //render scene
            this.onlyHitLayers_ = true;
            
            this.gpu_.clear();
            this.updateCamera();
            break;
    }
};

Melown.Renderer.prototype.hitTest = function(screenX_, screenY_) {
    var gl_ = this.gpu_.gl_;

    //get screen ray
    var screenRay_ = this.getScreenRay(screenX_, screenY_);
    var cameraPos_ = this.camera_.getPosition();

    //conver screen coords to texture coords
    if (gl_.checkFramebufferStatus(gl_.FRAMEBUFFER) != gl_.FRAMEBUFFER_COMPLETE) {
        return [0, 0, 0, null, screenRay_, Number.MAX_VALUE, cameraPos_];
    }

    var x_ = 0, y_ = 0;

    //get screen coords
    //if (this.curSize_[0] > this.curSize_[1]) {
    x_ = Math.floor(screenX_ * (this.hitmapSize_ / this.curSize_[0]));
    y_ = Math.floor(screenY_ * (this.hitmapSize_ / this.curSize_[1]));

    //console.log("hit screen: " + x_ + " " + y_);

    //get pixel value from framebuffer
    var pixel_ = this.hitmapTexture_.readFramebufferPixels(x_, this.hitmapSize_ - y_ - 1, 1, 1);

    //convert rgb values into depth
    var depth_ = (pixel_[0] * (1.0/255)) + (pixel_[1]) + (pixel_[2]*255.0) + (pixel_[3]*65025.0);// + (pixel_[3]*16581375.0);

    var surfaceHit_ = !(pixel_[0] == 255 && pixel_[1] == 255 && pixel_[2] == 255 && pixel_[3] == 255);


    //compute hit postion
    this.lastHitPosition_ = [cameraPos_[0] + screenRay_[0]*depth_, cameraPos_[1] + screenRay_[1]*depth_, cameraPos_[2] + screenRay_[2]*depth_];


    //this.hitTestGeoLayers(screenX_, screenY_, "hover");
    //this.core_.hover(screenX_, screenY_, false, { test:true});
    //this.core_.click(screenX_, screenY_, { test2:true});

    return [this.lastHitPosition_[0], this.lastHitPosition_[1], this.lastHitPosition_[2], surfaceHit_, screenRay_, depth_, cameraPos_];
};


Melown.Renderer.prototype.getZoffsetFactor = function(params_) {
    //var offsetFactor_ = 1.0 + this.distanceFactor_*params_[1]*((1-params_[2])+params_[2]*this.tiltFactor_);
//    return -Math.round(2000 * offsetFactor_ * params_[0]);
//    return 1.0/(this.camera_.getFar() - this.camera_.getNear()) * offsetFactor_ * params_[0];
//    return (1.0/(this.camera_.getFar() - this.camera_.getNear())) * (params_[0]*10000) * this.distanceFactor_;
//    return (1.0/(this.camera_.getFar() - this.camera_.getNear())) * offsetFactor_ * (params_[0]*10000);

    return (params_[0] + params_[1]*this.distanceFactor_ + params_[2]*this.tiltFactor_)*0.0001;
};

Melown.Renderer.prototype.saveScreenshot = function(output_, filename_, filetype_) {
    //this.updateHitmap_ = true;

    var gl_ = this.gpu_.gl_;

    //get current screen size
    var width_ = this.curSize_[0];
    var height_ = this.curSize_[1];

    //read rgba data from frame buffer
    //works only when webgl context is initialized with preserveDrawingBuffer: true
    var data2_ = new Uint8Array(width_ * height_ * 4);
    gl_.readPixels(0, 0, width_, height_, gl_.RGBA, gl_.UNSIGNED_BYTE, data2_);

    //flip image vertically
    var data_ = new Uint8Array(width_ * height_ * 4);
    var index_ = 0;

    for (var y = 0; y < height_; y++) {

        index2_ = ((height_-1) - y) * width_ * 4;

        for (var x = 0; x < width_; x++) {
            data_[index_] = data2_[index2_];
            data_[index_+1] = data2_[index2_+1];
            data_[index_+2] = data2_[index2_+2];
            data_[index_+3] = data2_[index2_+3];
            index_+=4;
            index2_+=4;
        }
    }

    // Create a 2D canvas to store the result
    var canvas_ = document.createElement('canvas');
    canvas_.width = width_;
    canvas_.height = height_;
    var context_ = canvas_.getContext('2d');

    // Copy the pixels to a 2D canvas
    var imageData_ = context_.createImageData(width_, height_);
    imageData_.data.set(data_);
    context_.putImageData(imageData_, 0, 0);

    filetype_ = filetype_ || "jpg"; 

    //open image in new window
    
    if (output_ == "file") {
        var a = document.createElement("a");

        var dataURI_= canvas_.toDataURL("image/" + filetype_);

        var byteString_ = atob(dataURI_.split(',')[1]);
        // separate out the mime component
        var mimeString_ = dataURI_.split(',')[0].split(':')[1].split(';')[0];
        
          // write the bytes of the string to an ArrayBuffer
        var ab = new ArrayBuffer(byteString_.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString_.length; i++) {
            ia[i] = byteString_.charCodeAt(i);
        }
      
        var file_ = new Blob([ab], {type: filetype_});

        var url_ = URL.createObjectURL(file_);
        a.href = url_;
        a.download = filename_;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url_);  
        }, 0); 
    } if (output_ == "tab") {
        window.open(canvas_.toDataURL("image/" + type_));
    }
    
    return imageData_;
};


Melown.Renderer.prototype.getBitmap = function(url_, filter_, tiled_) {
    var id_ = url_ + "*" + filter_ + "*" + tiled_;

    var texture_ = this.bitmaps_[id_];
    if (texture_ == null) {
        texture_ = new Melown.GpuTexture(this.gpu_, url_, this.core_, null, null, tiled_, filter_);
        this.bitmaps_[id_] = texture_;
    }

    return texture_;
};
/*
Melown.Renderer.prototype.setConfigParams = function(params_) {
    if (typeof params_ === "object" && params_ !== null) {
        for (var key_ in params_) {
            this.setConfigParam(key_, params_[key_]);
        }
    }
};*/
