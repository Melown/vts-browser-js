
import {utils as utils_} from '../utils/utils';
import GpuTexture_ from '../renderer/gpu/texture';

//get rid of compiler mess
var utils = utils_;
var GpuTexture = GpuTexture_;


var MapSubtexture = function(map, path, heightMap, tile, internal) {
    this.map = map;
    this.stats = map.stats;
    this.tile = tile; // used only for stats
    this.internal = internal; // used only for stats
    this.image = null;
    this.imageData = null;
    this.imageExtents = null;
    this.gpuTexture = null;
    this.loadState = 0;
    this.loadErrorTime = null;
    this.loadErrorCounter = 0;
    this.neverReady = false;
    this.mapLoaderUrl = path;
    this.heightMap = heightMap || false;
    this.statsCounter = 0;
    this.checkStatus = 0;
    this.checkType = null;
    this.checkValue = null;
    this.fastHeaderCheck = false;
    this.fileSize = 0;
    this.cacheItem = null; //store killImage
    this.gpuCacheItem = null; //store killGpuTexture
};


MapSubtexture.prototype.kill = function() {
    this.killImage();
    this.killGpuTexture();
    
    if (this.mask) {
        this.mask.killImage(); 
        this.mask.killGpuTexture(); 
    }
    
    //this.tile.validate();
};


MapSubtexture.prototype.killImage = function(killedByCache) {
    this.image = null;
    this.imageData = null;

    if (killedByCache != true && this.cacheItem) {
        this.map.resourcesCache.remove(this.cacheItem);
        //this.tile.validate();
    }

    if (this.mask) {
        this.mask.killImage(); 
    }

    if (!this.gpuTexture) {
        this.loadState = 0;
    } //else {
        //this.loadState = this.loadState;
    //}

    this.cacheItem = null;
};


MapSubtexture.prototype.killGpuTexture = function(killedByCache) {
/*
    //debug only    
    if (!this.map.lastRemoved) {
        this.map.lastRemoved = [];
    }

    //debug only    
    if (this.map.lastRemoved.indexOf(this.mapLoaderUrl) != -1) {
        console.log("tex: " + this.mapLoaderUrl);
    }

    //debug only    
    this.map.lastRemoved.unshift(this.mapLoaderUrl);
    this.map.lastRemoved = this.map.lastRemoved.slice(0,20);
*/

    if (this.gpuTexture != null) {
        this.stats.gpuTextures -= this.gpuTexture.size;
        this.gpuTexture.kill();

        this.stats.graphsFluxTexture[1][0]++;
        this.stats.graphsFluxTexture[1][1] += this.gpuTexture.size;

        if (this.mask) {
            this.mask.killGpuTexture(); 
        }
    }

    this.gpuTexture = null;

    if (killedByCache != true && this.gpuCacheItem) {
        this.map.gpuCache.remove(this.gpuCacheItem);
        //this.tile.validate();
    }

    if (!this.image && !this.imageData) {
        this.loadState = 0;
    }

    this.gpuCacheItem = null;
};


MapSubtexture.prototype.isReady = function(doNotLoad, priority, doNotCheckGpu, texture) {
    var doNotUseGpu = (this.map.stats.gpuRenderUsed >= this.map.maxGpuUsed);
    doNotLoad = doNotLoad || doNotUseGpu;
    
    if (this.neverReady) {
       return false;
    }

    switch (texture.checkType) {
        case "negative-type":
        case "negative-code":
        case "negative-size":
        
            if (this.checkStatus != 2) {
                this.checkType = texture.checkType;
                this.checkValue = texture.checkValue;

                if (this.checkStatus == 0) {
                    this.scheduleHeadRequest(priority, (this.checkType == "negative-size"));
                } else if (this.checkStatus == 3) { //loadError
                    if (this.loadErrorCounter <= this.map.config.mapLoadErrorMaxRetryCount &&
                        performance.now() > this.loadErrorTime + this.map.config.mapLoadErrorRetryTime) {
                        this.scheduleHeadRequest(priority, (this.checkType == "negative-size"));
                    }
                } else if (this.checkStatus == -1) {
            
                    if (texture.extraInfo) { //find at least texture with lower resolution
                        if (!texture.extraBound) {
                            texture.extraBound = { tile: texture.extraInfo.tile, layer: texture.extraInfo.layer};
                            texture.setBoundTexture(texture.extraBound.tile.parent, texture.extraBound.layer);        
                        }
        
                        while (texture.extraBound.texture.extraBound || texture.extraBound.texture.checkStatus == -1) {
                        //while (texture.extraBound.texture.checkStatus == -1) {
                            texture.setBoundTexture(texture.extraBound.sourceTile.parent, texture.extraBound.layer);        
                        }
                    }
                }
    
                return false;
            }
            
            break;
    }

    if (this.loadState == 2) { //loaded
        if (!doNotLoad && this.cacheItem) {
            this.map.resourcesCache.updateItem(this.cacheItem);
        }

        if (((this.heightMap && !this.imageData) || (!this.heightMap && !this.gpuTexture)) &&
              this.stats.renderBuild > this.map.config.mapMaxProcessingTime) {
            //console.log("testure resource build overflow");
            this.map.markDirty();
            return false;
        }

        if (doNotCheckGpu) {
            if (this.heightMap) {
                if (!this.imageData) {
                    var t = performance.now();
                    this.buildHeightMap();
                    this.stats.renderBuild += performance.now() - t; 
                }
            }

            return true;
        }

        if (this.heightMap) {
            if (!this.imageData) {
                var t = performance.now();
                this.buildHeightMap();
                this.stats.renderBuild += performance.now() - t; 
            }
        } else {
            if (!this.gpuTexture) {
                if (this.map.stats.gpuRenderUsed >= this.map.maxGpuUsed) {
                    return false;
                }
                
                if (doNotUseGpu) {
                    return false;
                }

                //if (this.stats.graphsFluxTexture [0][0] > 2) {
                   // return false;
                //}

                var t = performance.now();
                this.buildGpuTexture();
                this.stats.renderBuild += performance.now() - t; 
            }

            if (!doNotLoad && this.gpuCacheItem) {
                this.map.gpuCache.updateItem(this.gpuCacheItem);
            }
        }
        
        
        return true;
    } else {
        if (this.loadState == 0) { 
            if (doNotLoad) {
                //remove from queue
                //if (this.mapLoaderUrl) {
                    //this.map.loader.remove(this.mapLoaderUrl);
                //}
            } else {
                //not loaded
                //add to loading queue or top position in queue
                this.scheduleLoad(priority);
            }
        } else if (this.loadState == 3) { //loadError
            if (this.loadErrorCounter <= this.map.config.mapLoadErrorMaxRetryCount &&
                performance.now() > this.loadErrorTime + this.map.config.mapLoadErrorRetryTime) {

                this.scheduleLoad(priority);                    
            }
        } //else load in progress
    }

    return false;
};


MapSubtexture.prototype.scheduleLoad = function(priority, header) {
    this.map.loader.load(this.mapLoaderUrl, this.onLoad.bind(this, header), priority, this.tile, this.internal ? "texture-in" : "texture-ex");
};


MapSubtexture.prototype.onLoad = function(header, url, onLoaded, onError) {
    this.mapLoaderCallLoaded = onLoaded;
    this.mapLoaderCallError = onError;

    var onerror = this.onLoadError.bind(this);
    var onload = this.onLoaded.bind(this);

    if (header) {
        this.checkStatus = 1;
    } else {
        this.loadState = 1;
    }

    if (this.map.config.mapXhrImageLoad) {
        utils.loadBinary(url, this.onBinaryLoaded.bind(this), onerror, (utils.useCredentials ? (this.mapLoaderUrl.indexOf(this.map.url.baseUrl) != -1) : false), this.map.core.xhrParams, "blob");
    } else {
        this.image = utils.loadImage(url, onload, onerror, (this.map.core.tokenCookieHost ? (url.indexOf(this.map.core.tokenCookieHost) != -1) : false));
    }
    //mapXhrImageLoad
};


MapSubtexture.prototype.onLoadError = function(killBlob) {
    if (this.map.killed == true){
        return;
    }

    if (killBlob) {
        window.URL.revokeObjectURL(this.image.src);
    }

    this.loadState = 3;
    this.loadErrorTime = performance.now();
    this.loadErrorCounter ++;
    
    //make sure we try to load it again
    if (this.loadErrorCounter <= this.map.config.mapLoadErrorMaxRetryCount) { 
        setTimeout((function(){ if (!this.map.killed) { this.map.markDirty(); } }).bind(this), this.map.config.mapLoadErrorRetryTime);
    }    
    
    this.mapLoaderCallError();
};


MapSubtexture.prototype.onBinaryLoaded = function(data) {
    if (this.fastHeaderCheck && this.checkType && this.checkType != "metatile") {
        this.onHeadLoaded(null, data, null /*status*/);
        
        if (this.checkStatus == -1) {
            this.mapLoaderCallLoaded();
            return;
        }
    }

    var image = new Image();
    image.onerror = this.onLoadError.bind(this, true);
    image.onload = this.onLoaded.bind(this, true);
    this.image = image;
    image.src = window.URL.createObjectURL(data);
    this.fileSize = data.size;
};


MapSubtexture.prototype.onLoaded = function(killBlob) {
    if (this.map.killed){
        return;
    }

    if (killBlob) {
        window.URL.revokeObjectURL(this.image.src);
    }

    var size = this.image.naturalWidth * this.image.naturalHeight * (this.heightMap ? 3 : 3);
    
    if (!this.image.complete) {
        size = size;
    }
    
    //console.log(size);

    this.cacheItem = this.map.resourcesCache.insert(this.killImage.bind(this, true), size);

    this.map.markDirty();
    this.loadState = 2;
    this.loadErrorTime = null;
    this.loadErrorCounter = 0;
    this.mapLoaderCallLoaded();
};


MapSubtexture.prototype.scheduleHeadRequest = function(priority, downloadAll) {
    if (this.map.config.mapXhrImageLoad && this.fastHeaderCheck) {
        this.scheduleLoad(priority, true);
    } else {
        this.map.loader.load(this.mapLoaderUrl, this.onLoadHead.bind(this, downloadAll), priority, this.tile, this.internal, this.internal ? "texture-in" : "texture-ex");
    }
};


MapSubtexture.prototype.onLoadHead = function(downloadAll, url, onLoaded, onError) {
    this.mapLoaderCallLoaded = onLoaded;
    this.mapLoaderCallError = onError;

    var onerror = this.onLoadHeadError.bind(this, downloadAll);
    var onload = this.onHeadLoaded.bind(this, downloadAll);

    this.checkStatus = 1;

    if (downloadAll) {
        utils.loadBinary(url, onload, onerror, (utils.useCredentials ? (this.mapLoaderUrl.indexOf(this.map.url.baseUrl) != -1) : false), this.map.core.xhrParams, "blob");
    } else {
        utils.headRequest(url, onload, onerror, (utils.useCredentials ? (this.mapLoaderUrl.indexOf(this.map.url.baseUrl) != -1) : false), this.map.core.xhrParams, "blob");
    }
};


MapSubtexture.prototype.onLoadHeadError = function(downloadAll) {
    if (this.map.killed){
        return;
    }

    this.checkStatus = 3;
    this.loadErrorTime = performance.now();
    this.loadErrorCounter ++;
    
    //make sure we try to load it again
    if (this.loadErrorCounter <= this.map.config.mapLoadErrorMaxRetryCount) { 
        setTimeout((function(){ if (!this.map.killed) { this.map.markDirty(); } }).bind(this), this.map.config.mapLoadErrorRetryTime);
    }    
    
    this.mapLoaderCallError();
};


MapSubtexture.prototype.onHeadLoaded = function(downloadAll, data, status) {
    if (this.map.killed){
        return;
    }

    this.checkStatus = 2;
    this.loadErrorTime = null;
    this.loadErrorCounter = 0;

    if (this.map.config.mapXhrImageLoad && this.fastHeaderCheck) {

        switch (this.checkType) {
            case "negative-size":
                if (data) {
                    if (data.size == this.checkValue) {
                        this.checkStatus = -1;
                    }
                }
                break;
                
            case "negative-type":
                if (data) {
                    if (data.type == this.checkValue) {
                        this.checkStatus = -1;
                    }
                }
                break;
                
            case "negative-code":
                if (status) {
                    if (this.checkValue.indexOf(status) != -1) {
                        this.checkStatus = -1;
                    }
                }
                break;
        }

    } else {

        switch (this.checkType) {
            case "negative-size":
                if (data) {
                    if (data.byteLength == this.checkValue) {
                        this.checkStatus = -1;
                    }
                }
                break;
                
            case "negative-type":
                if (data) {
                    if (!data.indexOf) {
                        data = data;
                    }
                    
                    if (data.indexOf(this.checkValue) != -1) {
                        this.checkStatus = -1;
                    }
                }
                break;
                
            case "negative-code":
                if (status) {
                    if (this.checkValue.indexOf(status) != -1) {
                        this.checkStatus = -1;
                    }
                }
                break;
        }
        
        this.mapLoaderCallLoaded();
    }
};


MapSubtexture.prototype.buildGpuTexture = function () {
    this.gpuTexture = new GpuTexture(this.map.renderer.gpu, null, this.map.core);
    this.gpuTexture.createFromImage(this.image, "linear", false);
    this.stats.gpuTextures += this.gpuTexture.size;

    this.stats.graphsFluxTexture[0][0]++;
    this.stats.graphsFluxTexture[0][1] += this.gpuTexture.size;

    this.gpuCacheItem = this.map.gpuCache.insert(this.killGpuTexture.bind(this, true), this.gpuTexture.size);
};


MapSubtexture.prototype.buildHeightMap = function () {
    var canvas = document.createElement("canvas");
    canvas.width = this.image.naturalWidth;
    canvas.height = this.image.naturalHeight;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(this.image, 0, 0);
    this.imageData = ctx.getImageData(0, 0, this.image.naturalWidth, this.image.naturalHeight).data;
    this.imageExtents = [this.image.naturalWidth, this.image.naturalHeight];
    this.image = null;
};


MapSubtexture.prototype.getGpuTexture = function() {
    return this.gpuTexture;
};


MapSubtexture.prototype.getHeightMapValue = function(x, y) {
    if (this.imageData) {
        return this.imageData[(y * this.imageExtents[0] + x)*4];
    }
    
    return 0;
};

export default MapSubtexture;

