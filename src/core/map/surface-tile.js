
import {vec3 as vec3_, mat4 as mat4_} from '../utils/matrix';

//get rid of compiler mess
var vec3 = vec3_, mat4 = mat4_;


var MapSurfaceTile = function(map, parent, id) {
    this.map = map;
    this.id = id;
    this.parent = parent;
    this.viewCounter = map.viewCounter;
    this.renderCounter = 0;
    this.renderReady = false;
    this.geodataCounter = 0;
    this.texelSize = 1;
    this.texelSize2 = 1;
    this.distance = 1;

    this.metanode = null;  //[metanode, cacheItem]
    this.lastMetanode = null;
    this.boundmetaresources = null; //link to bound layers metatile storage

    this.surface = null; //surface or glue
    this.surfaceMesh = null;
    this.surfaceGeodata = null;     //probably only used in free layers
    this.surfaceGeodataView = null; //probably only used in free layers
    this.surfaceTextures = [];
    this.resourceSurface = null; //surface directing to resources

    this.virtual = false;
    this.virtualReady = false;
    this.virtualSurfaces = [];
    
    this.resetDrawCommands = false;
    this.drawCommands = [[], [], []];
    
    this.bounds = {};
    this.boundLayers = {};
    this.boundTextures = {};
    this.updateBounds = true;

    this.heightMap = null;
    this.drawCommands = [[], [], []];
    this.imageryCredits = {};
    this.glueImageryCredits = {};
    this.mapdataCredits = {};
    
    this.resources = this.map.resourcesTree.findNode(id, true);   // link to resource tree
    this.metaresources = this.map.resourcesTree.findAgregatedNode(id, 5, true); //link to meta resource tree
    this.boundresources = this.map.resourcesTree.findAgregatedNode(id, 8, true); //link to meta resource tree
    
    /*if (!this.resources) {
        debugger;
    }*/

    this.children = [null, null, null, null];
};


MapSurfaceTile.prototype.kill = function() {
    //kill children
    for (var i = 0; i < 4; i++) {
        if (this.children[i] != null) {
            this.children[i].kill();
        }
    }
/*
    if (this.surfaceMesh != null) {
        this.surfaceMesh.kill();
    }

    for (var key in this.surfaceTextures) {
        if (this.surfaceTextures[key] != null) {
            this.surfaceTextures[key].kill();
        }
    }

    if (this.surfaceGeodata != null) {
        this.surfaceGeodata.kill();
    }

    if (this.surfaceGeodataView != null) {
        this.surfaceGeodataView.kill();
    }

    if (this.heightMap != null) {
        this.heightMap.kill();
    }

    for (var key in this.boundTextures) {
        if (this.boundTextures[key] != null) {
            this.boundTextures[key].kill();
        }
    }
*/
    this.resources = null;
    this.metaresources = null;
    this.metanode = null;

    this.surface = null;
    this.surfaceMesh = null;
    this.surfaceTextures = [];
    this.surfaceGeodata = null;
    this.surfaceGeodataView = null;
    this.resourceSurface = null;

    this.bounds = {};
    this.boundLayers = {};
    this.boundTextures = {};
    this.updateBounds = true;

    this.virtual = false;
    this.virtualReady = false;
    this.virtualSurfaces = [];

    this.renderReady = false;
    this.lastSurface = null;
    this.lastState = null;
    this.lastRenderState = null;
        
    this.heightMap = null;
    this.drawCommands = [[], [], []];
    this.imageryCredits = {};
    this.glueImageryCredits = {};
    this.mapdataCredits = {};

    this.verifyChildren = false;
    this.children = [null, null, null, null];

    var parent = this.parent;
    this.parent = null;

    if (parent != null) {
        parent.removeChild(this);
    }
};


MapSurfaceTile.prototype.validate = function() {
    //is tile empty?
    if (this.metaresources == null || !this.metaresources.getMetatile(this.surface, null, this)) {
        //this.kill();
    }
};


MapSurfaceTile.prototype.viewSwitched = function() {
    //store last state for view switching
    this.lastSurface = this.surface;
    this.lastState = {
        surfaceMesh : this.surfaceMesh,
        surfaceTextures : this.surfaceTextures,
        boundTextures : this.boundTextures,
        surfaceGeodata : this.surfaceGeodata,
        surfaceGeodataView : this.surfaceGeodataView,
        resourceSurface : this.resourceSurface 
    };    

    if (this.drawCommands[0].length > 0) {  // check only visible chanel
        this.lastRenderState = {
            drawCommands : this.drawCommands,
            imageryCredits : this.imageryCredits,
            mapdataCredits : this.mapdataCredits
        };
    } else {
        this.lastRenderState = null;
    }

    
    //zero surface related data    
    this.verifyChildren = true;
    this.renderReady = false;
    this.lastMetanode = this.metanode;
    //this.metanode = null; //keep old value for smart switching


    //this.lastMetanode = null;
    //this.metanode = null;

    for (var key in this.bounds) {
        this.bounds[key] = {
            sequence : [],
            alpha : [],
            transparent : false,
            viewCoutner : 0
        };
    }

    this.boundLayers = {};
    this.boundTextures = {};
    this.updateBounds = true;
    this.transparentBounds = false;

    this.surface = null;
    this.surfaceMesh = null;
    this.surfaceTextures = [];
    this.surfaceGeodata = null;
    this.surfaceGeodataView = null;
    this.resourceSurface = null;
    
    this.virtual = false;
    this.virtualReady = false;
    this.virtualSurfaces = [];
    
    this.drawCommands = [[], [], []];
    this.imageryCredits = {};
    this.glueImageryCredits = {};
    this.mapdataCredits = {};
};


MapSurfaceTile.prototype.restoreLastState = function() {
    if (!this.lastState) {
        return;
    }
    this.surfaceMesh = this.lastState.surfaceMesh;
    this.surfaceTextures = this.lastState.surfaceTextures; 
    this.boundTextures = this.lastState.boundTextures;
    this.surfaceGeodata = this.lastState.surfaceGeodata;
    this.surfaceGeodataView = this.lastState.surfaceGeodataView;
    this.resourceSurface = this.lastState.resourceSurface; 
    this.lastSurface = null;
    this.lastState = null;
    this.lastResourceSurface = null;
};


MapSurfaceTile.prototype.addChild = function(index) {
    if (this.children[index]) {
        return;
    }
    
    var id = this.id;
    var childId = [id[0] + 1, id[1] << 1, id[2] << 1];

    switch (index) {
        case 1: childId[1]++; break;
        case 2: childId[2]++; break;
        case 3: childId[1]++; childId[2]++; break;
    }

    this.children[index] = new MapSurfaceTile(this.map, this, childId);
};


MapSurfaceTile.prototype.removeChildByIndex = function(index) {
    if (this.children[index] != null) {
        this.children[index].kill();
        this.children[index] = null;
    }
    
    //remove resrource node?
};


MapSurfaceTile.prototype.removeChild = function(tile) {
    for (var i = 0; i < 4; i++) {
        if (this.children[i] == tile) {
            this.children[i].kill();
            this.children[i] = null;
        }
    }
};


MapSurfaceTile.prototype.isMetanodeReady = function(tree, priority, preventLoad) {
    //has map view changed?
    if (this.map.viewCounter != this.viewCoutner) {
        this.viewSwitched();
        this.viewCoutner = this.map.viewCounter;
        this.map.markDirty(); 

        if (this.lastRenderState) {
            this.lastRenderState = this.lastRenderState; //debug
        }
    }
        
    if (!preventLoad) {
   
        //provide surface for tile
        if (this.virtualSurfacesUncomplete || (this.surface == null && this.virtualSurfaces.length == 0) ) { //|| this.virtualSurfacesUncomplete) {
            this.checkSurface(tree, priority);
        }
   
        //provide metanode for tile
        if (this.metanode == null || this.lastMetanode) {
            
            if (!this.virtualSurfacesUncomplete) {
                var ret = this.checkMetanode(tree, priority);
                
                if (!ret && !(this.metanode != null && this.lastMetanode)) { //metanode is not ready yet
                    return;
                }
            }
            
            if (this.lastMetanode) {
                processFlag2 = true;
            }
        }
        
    }

    if (this.metanode == null) { // || processFlag3) { //only for wrong data
        return false;
    }

    this.metanode.metatile.used();

    if (this.lastSurface && this.lastSurface == this.surface) {
        this.lastSurface = null;
        this.restoreLastState();
        //return;
    }

    if (this.surface) {
        if (this.surface.virtual) {
            this.resourceSurface = this.surface.getSurface(this.metanode.sourceReference);
            if (!this.resourceSurface) {
                this.resourceSurface = this.surface;
            }
        } else {
            this.resourceSurface = this.surface;
        }
    }

    return true;
};


MapSurfaceTile.prototype.checkSurface = function(tree, priority) {
    this.surface = null;
    this.virtual = false;
    this.virtualReady = false;
    this.virtualSurfaces = [];
    this.virtualSurfacesUncomplete = false;
    
    if (tree.freeLayerSurface) {  //free layer has only one surface
        this.surface = tree.freeLayerSurface;
        return; 
    }

    /*
    if (this.id[0] == 0 && this.id[1] == 0 && this.id[2] == 0) {
        tree = tree;
    }

    if (this.id[0] == 1 && this.id[1] == 0 && this.id[2] == 0) {
        tree = tree;
    }

    if (this.id[0] == 2 && this.id[1] == 1 && this.id[2] == 1) {
        tree = tree;
    }

    if (this.id[0] == 3 && this.id[1] == 3 && this.id[2] == 3) {
        tree = tree;
    }

    if (this.id[0] == 4 && this.id[1] == 7 && this.id[2] == 7) {
        tree = tree;
    }

    if (this.id[0] == 15 && this.id[1] == 16297 && this.id[2] == 16143) {
        tree = tree;
    }

    if (this.id[0] == 16 && this.id[1] == 32595 && this.id[2] == 32287) {
        tree = tree;
    }*/

    var sequence = tree.surfaceSequence;

    //multiple surfaces
    //build virtual surfaces array
    //find surfaces with content
    for (var i = 0, li = sequence.length; i < li; i++) {
        var surface = sequence[i][0];
        var alien = sequence[i][1];

        var res = surface.hasTile2(this.id);
        if (res[0] == true) {
            
            //check if tile exist
            if (this.id[0] > 0) { //surface.lodRange[0]) {
                // removed for debug !!!!!
                // ????????
                var parent = this.parent;
                if (parent) { 
                    
                    if (parent.virtualSurfacesUncomplete) {
                        this.virtualSurfacesUncomplete = true;
                        this.virtualSurfaces = [];
                        return;
                    }
                    
                    var metatile = parent.metaresources.getMetatile(surface, null, this);
                    if (metatile) {
                        
                        if (!metatile.isReady(priority)) {
                            this.virtualSurfacesUncomplete = true;
                            continue;
                        }
                        
                        var node = metatile.getNode(parent.id);
                        if (node) {
                            if (!node.hasChildById(this.id)) {
                                continue;
                            }
                        } else {
                            continue;
                        }
                    } else {
                        continue;
                    }
                }
            }
    
            //store surface
            this.virtualSurfaces.push([surface, alien]);        
        }
    }

  //  if (this.virtualSurfacesUncomplete) {
  //      this.metanode = null;
  //  }

    //
    if (this.virtualSurfaces.length > 1) {
        this.virtual = true;
    } else {
        this.surface = (this.virtualSurfaces[0]) ? this.virtualSurfaces[0][0] : null;
    }
};


MapSurfaceTile.prototype.checkMetanode = function(tree, priority) {
    if (this.virtual) {
        if (this.isVirtualMetanodeReady(tree, priority)) {
            this.metanode = this.createVirtualMetanode(tree, priority);
            this.lastMetanode = null;
            this.map.markDirty();
        } else {
            return false;
        }
    }

    //var surface = this.surface || this.surface; ?????
    var surface = this.surface;

    if (surface == null) {
        return false;
    }

    var metatile = this.metaresources.getMetatile(surface, true, this);

    if (metatile.isReady(priority) == true) {

        if (!this.virtual) {
            this.metanode = metatile.getNode(this.id);
            this.lastMetanode = null;
            this.map.markDirty(); 
        }

        if (this.metanode != null) {
            this.metanode.tile = this; //used only for validate
            this.lastMetanode = null;
            this.map.markDirty(); 

            for (var i = 0; i < 4; i++) {
                if (this.metanode.hasChild(i) == true) {
                    this.addChild(i);
                } else {
                    this.removeChildByIndex(i);
                }
            }
        }

    } else {
        return false;
    }
    
    return true;
};


MapSurfaceTile.prototype.isVirtualMetanodeReady = function(tree, priority) {
    var surfaces = this.virtualSurfaces;
    var readyCount = 0;

    for (var i = 0, li = surfaces.length; i < li; i++) {
        var surface = surfaces[i][0];
        var metatile = this.metaresources.getMetatile(surface, true, this);

        if (metatile.isReady(priority) == true) {
            readyCount++;
        }
    }
    
    if (readyCount == li) {
        return true;        
    } else {
        return false;
    }
};


MapSurfaceTile.prototype.createVirtualMetanode = function(tree, priority) {
    var surfaces = this.virtualSurfaces;
    var first = false;
    var node = null;

    //get top most existing surface
    for (var i = 0, li = surfaces.length; i < li; i++) {
        var surface = surfaces[i][0];
        var alien = surfaces[i][1];
        var metatile = this.metaresources.getMetatile(surface, null, this);

        if (metatile.isReady(priority) == true) {
            var metanode = metatile.getNode(this.id);

            if (metanode != null) {
                if (alien != metanode.alien) {
                    continue;
                }

                //does metanode have surface reference?
                //internalTextureCount is reference to surface
                if (!alien && surface.glue && !metanode.hasGeometry() &&
                    metanode.internalTextureCount > 0) {
                    
                    var desiredSurfaceIndex = metanode.internalTextureCount - 1;
                    desiredSurfaceIndex = this.map.getSurface(surface.id[desiredSurfaceIndex]).viewSurfaceIndex;
                    
                    var jump = false; 
                        
                    for (var j = i; j < li; j++) {
                        if (surfaces[j].viewSurfaceIndex <= desiredSurfaceIndex) {
                            jump = (j > i);
                            i = j - 1;
                            break;
                        }
                    }
                    
                    if (jump) {
                        continue;
                    }                         
                }
                
                if (metanode.hasGeometry()) {
                    node = metanode.clone();
                    this.surface = surface;
                    break;
                }
            }
        }
    }

    //extend bbox, credits and children flags by other surfaces
    for (var i = 0, li = surfaces.length; i < li; i++) {
        var surface = surfaces[i][0];
        var metatile = this.metaresources.getMetatile(surface, null, this);

        if (metatile.isReady(priority) == true) {
            var metanode = metatile.getNode(this.id);

            if (metanode != null) {
                //does metanode have surface reference?
                //internalTextureCount is reference to surface
                /*
                if (surface.glue && !metanode.hasGeometry() &&
                    metanode.internalTextureCount > 0) {
                    i = this.map.surfaceSequenceIndices[metanode.internalTextureCount - 1] - 1;
                    continue;
                }*/

                if (!node) { //just in case all surfaces are without geometry
                    node = metanode.clone();
                    this.surface = surface;
                } else {
                    node.flags |= metanode.flags & ((15)<<4); 

                    /*
                    for (var j = 0, lj = metanode.credits.length; j <lj; j++) {
                        if (node.credits.indexOf(metanode.credits[j]) == -1) {
                            node.credits.push(metanode.credits[j]);
                        } 
                    }*/
                   
                    if (metatile.useVersion < 4) {
                        // removed for debug !!!!!
                        node.bbox.min[0] = Math.min(node.bbox.min[0], metanode.bbox.min[0]); 
                        node.bbox.min[1] = Math.min(node.bbox.min[1], metanode.bbox.min[1]); 
                        node.bbox.min[2] = Math.min(node.bbox.min[2], metanode.bbox.min[2]); 
                        node.bbox.max[0] = Math.max(node.bbox.max[0], metanode.bbox.max[0]); 
                        node.bbox.max[1] = Math.max(node.bbox.max[1], metanode.bbox.max[1]); 
                        node.bbox.max[2] = Math.max(node.bbox.max[2], metanode.bbox.max[2]);
                    }
                }
            }
        }
    }
    
    if (node) {
        node.generateCullingHelpers(true);
    }
    
    return node;
};


MapSurfaceTile.prototype.bboxVisible = function(id, bbox, cameraPos, node) {
    var map = this.map;
    var camera = map.camera;
    if (id[0] < map.measure.minDivisionNodeDepth) {
        return true;
    }
    
    var skipGeoTest = map.config.mapDisableCulling;
    if (!skipGeoTest && map.isGeocent) {
        if (node) {
            if (true) {  //version with perspektive
                var p2 = node.diskPos;
                var p1 = camera.position;
                var camVec = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
                var distance = vec3.normalize4(camVec) * camera.distanceFactor;
                //vec3.normalize(camVec);
                
                var a = vec3.dot(camVec, node.diskNormal);
            } else {
                var a = vec3.dot(camera.vector, node.diskNormal);
            }
            
            if (distance > 150000 && a > node.diskAngle) {
                return false;
            }
        }
    }

    if (node.metatile.useVersion >= 4) {
        return camera.camera.pointsVisible(node.bbox2, cameraPos);
    } else {
        if (!(map.isGeocent && (map.config.mapPreciseBBoxTest)) || id[0] < 4) {
            return camera.camera.bboxVisible(bbox, cameraPos);
        } else {
            return camera.camera.pointsVisible(node.bbox2, cameraPos);
        }
    }
};


MapSurfaceTile.prototype.getPixelSize = function(bbox, screenPixelSize, cameraPos, worldPos, returnDistance) {
    var min = bbox.min;
    var max = bbox.max;
    var tilePos1x = min[0] - cameraPos[0];
    var tilePos1y = min[1] - cameraPos[1];
    var tilePos2x = max[0] - cameraPos[0];
    var tilePos2y = min[1] - cameraPos[1];
    var tilePos3x = max[0] - cameraPos[0];
    var tilePos3y = max[1] - cameraPos[1];
    var tilePos4x = min[0] - cameraPos[0];
    var tilePos4y = max[1] - cameraPos[1];
    var h1 = min[2] - cameraPos[2];
    var h2 = max[2] - cameraPos[2];
    
    //camera inside bbox
    if (!this.map.config.mapLowresBackground) {
        if (cameraPos[0] > min[0] && cameraPos[0] < max[0] &&
            cameraPos[1] > min[1] && cameraPos[1] < max[1] &&
            cameraPos[2] > min[2] && cameraPos[2] < max[2]) {
    
            if (returnDistance == true) {
                return [Number.POSITIVEINFINITY, 0.1];
            }
        
            return Number.POSITIVEINFINITY;
        }
    }

    var factor = 0;
    var camera = this.map.camera.camera;

    //find bbox sector
    if (0 < tilePos1y) { //top row - zero means camera position in y
        if (0 < tilePos1x) { // left top corner
            if (0 > h2) { // hi
                factor = camera.scaleFactor([tilePos1x, tilePos1y, h2], returnDistance);
            } else if (0 < h1) { // low
                factor = camera.scaleFactor([tilePos1x, tilePos1y, h1], returnDistance);
            } else { // middle
                factor = camera.scaleFactor([tilePos1x, tilePos1y, (h1 + h2)*0.5], returnDistance);
            }
        } else if (0 > tilePos2x) { // right top corner
            if (0 > h2) { // hi
                factor = camera.scaleFactor([tilePos2x, tilePos2y, h2], returnDistance);
            } else if (0 < h1) { // low
                factor = camera.scaleFactor([tilePos2x, tilePos2y, h1], returnDistance);
            } else { // middle
                factor = camera.scaleFactor([tilePos2x, tilePos2y, (h1 + h2)*0.5], returnDistance);
            }
        } else { //top side
            if (0 > h2) { // hi
                factor = camera.scaleFactor([(tilePos1x + tilePos2x)*0.5, tilePos2y, h2], returnDistance);
            } else if (0 < h1) { // low
                factor = camera.scaleFactor([(tilePos1x + tilePos2x)*0.5, tilePos2y, h1], returnDistance);
            } else { // middle
                factor = camera.scaleFactor([(tilePos1x + tilePos2x)*0.5, tilePos2y, (h1 + h2)*0.5], returnDistance);
            }
        }
    } else if (0 > tilePos4y) { //bottom row
        if (0 < tilePos4x) { // left bottom corner
            if (0 > h2) { // hi
                factor = camera.scaleFactor([tilePos4x, tilePos4y, h2], returnDistance);
            } else if (0 < h1) { // low
                factor = camera.scaleFactor([tilePos4x, tilePos4y, h1], returnDistance);
            } else { // middle
                factor = camera.scaleFactor([tilePos4x, tilePos4y, (h1 + h2)*0.5], returnDistance);
            }
        } else if (0 > tilePos3x) { // right bottom corner
            if (0 > h2) { // hi
                factor = camera.scaleFactor([tilePos3x, tilePos3y, h2], returnDistance);
            } else if (0 < h1) { // low
                factor = camera.scaleFactor([tilePos3x, tilePos3y, h1], returnDistance);
            } else { // middle
                factor = camera.scaleFactor([tilePos3x, tilePos3y, (h1 + h2)*0.5], returnDistance);
            }
        } else { //bottom side
            if (0 > h2) { // hi
                factor = camera.scaleFactor([(tilePos4x + tilePos3x)*0.5, tilePos3y, h2], returnDistance);
            } else if (0 < h1) { // low
                factor = camera.scaleFactor([(tilePos4x + tilePos3x)*0.5, tilePos3y, h1], returnDistance);
            } else { // middle
                factor = camera.scaleFactor([(tilePos4x + tilePos3x)*0.5, tilePos3y, (h1 + h2)*0.5], returnDistance);
            }
        }
    } else { //middle row
        if (0 < tilePos4x) { // left side
            if (0 > h2) { // hi
                factor = camera.scaleFactor([tilePos1x, (tilePos2y + tilePos3y)*0.5, h2], returnDistance);
            } else if (0 < h1) { // low
                factor = camera.scaleFactor([tilePos1x, (tilePos2y + tilePos3y)*0.5, h1], returnDistance);
            } else { // middle
                factor = camera.scaleFactor([tilePos1x, (tilePos2y + tilePos3y)*0.5, (h1 + h2)*0.5], returnDistance);
            }
        } else if (0 > tilePos3x) { // right side
            if (0 > h2) { // hi
                factor = camera.scaleFactor([tilePos2x, (tilePos2y + tilePos3y)*0.5, h2], returnDistance);
            } else if (0 < h1) { // low
                factor = camera.scaleFactor([tilePos2x, (tilePos2y + tilePos3y)*0.5, h1], returnDistance);
            } else { // middle
                factor = camera.scaleFactor([tilePos2x, (tilePos2y + tilePos3y)*0.5, (h1 + h2)*0.5], returnDistance);
            }
        } else { //center
            if (0 > h2) { // hi
                factor = camera.scaleFactor([(tilePos1x + tilePos2x)*0.5, (tilePos2y + tilePos3y)*0.5, h2], returnDistance);
            } else if (0 < h1) { // low
                factor = camera.scaleFactor([(tilePos1x + tilePos2x)*0.5, (tilePos2y + tilePos3y)*0.5, h1], returnDistance);
            } else { // middle
                factor = camera.scaleFactor([(tilePos1x + tilePos2x)*0.5, (tilePos2y + tilePos3y)*0.5, (h1 + h2)*0.5], returnDistance);
            }
        }
    }

    //console.log("new: " + (factor * screenPixelSize) + " old:" + this.tilePixelSize2(node) );

    if (returnDistance == true) {
        return [(factor[0] * screenPixelSize), factor[1]];
    }

    return (factor * screenPixelSize);
};


MapSurfaceTile.prototype.getPixelSize3Old = function(node, screenPixelSize, factor) {
    var camera = this.map.camera;
    var d = (camera.geocentDistance*factor) - node.diskDistance;
    if (d < 0) {
        d = -d;
        //return [Number.POSITIVEINFINITY, 0.1];
    } 

    var a = vec3.dot(camera.geocentNormal, node.diskNormal);
    
    if (a < node.diskAngle2) {
        var a2 = Math.acos(a); 
        var a3 = Math.acos(node.diskAngle2);
        a2 = a2 - a3; 

        var l1 = Math.tan(a2) * node.diskDistance;
        d = Math.sqrt(l1*l1 + d*d);
    }

    var factor = camera.camera.scaleFactor2(d);
    return [factor * screenPixelSize, d];
};


MapSurfaceTile.prototype.getPixelSize3 = function(node, screenPixelSize, factor) {
    //if (this.map.drawIndices) {
      //  return this.getPixelSize3Old(node, screenPixelSize, factor);
    //}
    var camera = this.map.camera;
    var cameraDistance = camera.geocentDistance;// * factor;

    var a = vec3.dot(camera.geocentNormal, node.diskNormal); //get angle between tile normal and cameraGeocentNormal
    var d = cameraDistance - (node.diskDistance + (node.maxZ - node.minZ)); //vertical distance from top bbox level
    
    if (a < node.diskAngle2) { //is camera inside tile conus?
        
        //get horizontal distance
        var a2 = Math.acos(a); 
        var a3 = node.diskAngle2A;
        a2 = a2 - a3; 
        var l1 = Math.tan(a2) * node.diskDistance;// * factor;

        if (d < 0) { //is camera is belown top bbox level?
            var d2 = cameraDistance - node.diskDistance;
            if (d2 < 0) { //is camera is belown bottom bbox level?
                d = -d2;
                d = Math.sqrt(l1*l1 + d*d);
            } else { //is camera inside bbox
                d = l1;
            }
        } else {
            d = Math.sqrt(l1*l1 + d*d);
        }

    } else {
        if (d < 0) { //is camera is belown top bbox level?
            var d2 = cameraDistance - node.diskDistance;
            if (d2 < 0) { //is camera is belown bottom bbox level?
                d = -d2;
            } else { //is camera inside bbox
                return [Number.POSITIVEINFINITY, 0.1];
            }
        } 
    }

    return [camera.camera.scaleFactor2(d) * screenPixelSize, d];
};

/*

MapSurfaceTile.prototype.getPixelSize22 = function(bbox, screenPixelSize, cameraPos, worldPos, returnDistance) {
    var min = bbox.min;
    var max = bbox.max;
    var p1 = bbox.center();
    bbox.updateMaxSize();
    var d = bbox.maxSize * 0.5; 
    
    var dd = [cameraPos[0]-p1[0],
               cameraPos[1]-p1[1],
               cameraPos[2]-p1[2]]; 

    var d2 = vec3.length(dd) - (bbox.maxSize * 0.5);

    var factor = this.camera.scaleFactor2(d2);

    if (returnDistance == true) {
        return [(factor[0] * screenPixelSize), factor[1]];
    }

    return (factor * screenPixelSize);
};
*/

MapSurfaceTile.prototype.updateTexelSize = function() {
    var pixelSize;
    var pixelSize2;
    var map = this.map;
    var draw = map.draw;
    var camera = map.camera;
    var texelSizeFit = draw.texelSizeFit;
    var node = this.metanode;
    var cameraPos = map.camera.position;
    var preciseDistance = (map.isGeocent && (map.config.mapPreciseDistanceTest || node.metatile.useVersion >= 4));  

    if (node.hasGeometry()) {
        var screenPixelSize = Number.POSITIVEINFINITY;

        if (node.usedTexelSize()) {
            screenPixelSize = draw.ndcToScreenPixel * node.pixelSize;
        } else if (node.usedDisplaySize()) {
            screenPixelSize = draw.ndcToScreenPixel * (node.bbox.maxSize / node.displaySize);
        }

        if (camera.camera.ortho == true) {
            var height = camera.camera.getViewHeight();
            pixelSize = [(screenPixelSize*2.0) / height, height];
        } else {
            
            if (node.usedDisplaySize()) { 
               
                if (!preciseDistance) {
                    screenPixelSize = draw.ndcToScreenPixel * (node.bbox.maxSize / 256);

                    var factor = (node.displaySize / 256) * camera.distance;
                    //var factor = (256 / 256) * this.map.cameraDistance;
                    
                    var v = camera.vector; //move camera away hack
                    var p = [cameraPos[0] - v[0] * factor, cameraPos[1] - v[1] * factor, cameraPos[2] - v[2] * factor];

                    pixelSize = this.getPixelSize(node.bbox, screenPixelSize, p, p, true);
                } else {
                    screenPixelSize = draw.ndcToScreenPixel * (node.bbox.maxSize / 256) * (256 / node.displaySize);

                    pixelSize = this.getPixelSize3(node, screenPixelSize, 1);
                }
            } else {
                
                if (!preciseDistance && texelSizeFit > 1.1) {
                    screenPixelSize = draw.ndcToScreenPixel * node.pixelSize * (texelSizeFit / 1.1);
                    var factor = (texelSizeFit / 1.1) * camera.distance;
                    
                    var v = camera.vector; //move camera away hack
                    var p = [cameraPos[0] - v[0] * factor, cameraPos[1] - v[1] * factor, cameraPos[2] - v[2] * factor];
                    
                    pixelSize = this.getPixelSize(node.bbox, screenPixelSize, p, p, true);
                } else {
                    if (preciseDistance) {
                        pixelSize = this.getPixelSize3(node, screenPixelSize, 1);
                    } else {
                        pixelSize = this.getPixelSize(node.bbox, screenPixelSize, cameraPos, cameraPos, true);
                    }
                }
            }
        }
    } else {
        if (preciseDistance) {
            pixelSize = this.getPixelSize3(node, 1, 1);
        } else {
            pixelSize = this.getPixelSize(node.bbox, 1, cameraPos, cameraPos, true);
        }

        //pixelSize = this.getPixelSize(node.bbox, 1, cameraPos, cameraPos, true);
        pixelSize[0] = Number.POSITIVEINFINITY;
    }

    this.texelSize = pixelSize[0];
    this.distance = pixelSize[1];

    //degrade horizont
    if (!map.config.mapDegradeHorizon || draw.degradeHorizonFactor < 1.0) {
        return;
    }

    var degradeHorizon = map.config.mapDegradeHorizonParams;
    var degradeFadeStart = degradeHorizon[1];
    var degradeFadeEnd = degradeHorizon[2];

    //reduce degrade factor by tilt
    var degradeFactor = draw.degradeHorizonFactor * draw.degradeHorizonTiltFactor; 
    var distance = this.distance * camera.distanceFactor;

    //apply degrade factor smoothly from specified tile distance
    if (distance < degradeFadeStart) {
        degradeFactor = 1.0;
    } else if (distance > degradeFadeStart && distance < degradeFadeEnd) {
        degradeFactor = 1.0 + (degradeFactor-1.0) * ((distance - degradeFadeStart) / (degradeFadeEnd - degradeFadeStart));
    }

    degradeFactor = Math.max(degradeFactor, 1.0);

    //reduce degrade factor by observed distance
    var observerDistance = camera.perceivedDistance;
    var distanceFade = degradeHorizon[3];

    if (observerDistance > distanceFade) {
        degradeFactor = 1.0;
    } else if (observerDistance < distanceFade && degradeFactor > 1.0) {
        degradeFactor = 1.0 + ((degradeFactor - 1.0) * (1.0-(observerDistance / distanceFade)));
    }

    //console.log("degrade: " + degradeFactor);

    this.texelSize /= degradeFactor;
};


MapSurfaceTile.prototype.drawGrid = function(cameraPos, divNode, angle) {
    if ((this.texelSize == Number.POSITIVEINFINITY || this.texelSize > 4.4) && this.metanode && this.metanode.hasChildren()) {
        return;
    }
    
    var fastGrid = this.map.config.mapFastHeightfiled;
    
    //if (!(this.id[0] == 18 && this.id[1] == 130381 && this.id[2] == 129151)) {
      //  return;
    //}

    var map = this.map;
    
    if (divNode) {
        var node = divNode[0]; 
        var ll = divNode[1][0];
        var ur = divNode[1][1];
    } else {
        var res = map.measure.getSpatialDivisionNodeAndExtents(this.id);
        var node = res[0]; 
        var ll = res[1][0];
        var ur = res[1][1];
    }
   
    var middle = [(ur[0] + ll[0])* 0.5, (ur[1] + ll[1])* 0.5];
    var normal = [0,0,0];

    var hasPoles = map.referenceFrame.hasPoles;

    //var pseudomerc = (node.srs.id == "pseudomerc");
    var subdivision = angle; 
    var angle = angle || this.metanode.diskAngle2;
    
    if ((hasPoles && !node.isPole) &&  Math.acos(angle) > Math.PI*0.1) {
        angle = Math.cos(Math.acos(angle) * 0.5); 
        
        this.drawGrid(cameraPos, [node, [ [ll[0], ll[1]],  [middle[0], middle[1]] ] ], angle);
        this.drawGrid(cameraPos, [node, [ [middle[0], ll[1]],  [ur[0], middle[1]] ] ], angle);

        this.drawGrid(cameraPos, [node, [ [ll[0], middle[1]],  [middle[0], ur[1]] ] ], angle);
        this.drawGrid(cameraPos, [node, [ [middle[0], middle[1]],  [ur[0], ur[1]] ] ], angle);
       
        return;
    }
     
    var desiredSamplesPerViewExtent = 5;
    var nodeExtent = node.extents.ur[1] - node.extents.ll[1];
    var viewExtent = this.distance ;//* 0.1;
    var lod = Math.log((desiredSamplesPerViewExtent * nodeExtent) / viewExtent) / map.log2;
    lod = Math.max(0,lod - 8 + node.id[0]);
    
    //var lod = map.measure.getOptimalHeightLod(middle, this.distance, 5);
    
    var coords = [
        [ur[0], ur[1]],
        [ur[0], ll[1]],
        [ll[0], ll[1]],
        [ll[0], ur[1]],

        [middle[0], ur[1]],
        [middle[0], ll[1]],
    
        [ll[0], middle[1]],
        [ur[0], middle[1]]
    ];    

    var flatGrid = true; 

    if (fastGrid) {
        if (!this.metanode) {
            return;
        }
        
        if (flatGrid) {
            //var h = this.metanode.minZ;
            var h = this.metanode.surrogatez;
    
            //if (this.map.drawLods) { h = this.metanode.minZ; }


        var coordsRes = [[h],[h],[h],[h],[h],[h],[h],[h]];

            //middle[2] = h;
            //middle = node.getPhysicalCoords(middle, true);

        } else {

            var mnode = this.metanode; 
            
            if (!mnode.hmap) {
                
                var border = mnode.border;
                var n;
                
                if (!border) {
                    mnode.border = new Array(9);
                    border = mnode.border;
                    border[4] = mnode.minZ;
                }
                
                var skip = false;
                
                if (border[0] == null) {
                    n = this.map.tree.getNodeById([this.id[0], this.id[1] - 1, this.id[2] - 1]);
                    if (n) { border[0] = n.minZ; } else { skip = true; }
                }

                if (border[1] == null) {
                    n = this.map.tree.getNodeById([this.id[0], this.id[1], this.id[2] - 1]);
                    if (n) { border[1] = n.minZ; } else { skip = true; }
                }

                if (border[2] == null) {
                    n = this.map.tree.getNodeById([this.id[0], this.id[1] + 1, this.id[2] - 1]);
                    if (n) { border[2] = n.minZ; } else { skip = true; }
                }

                if (border[3] == null) {
                    n = this.map.tree.getNodeById([this.id[0], this.id[1] - 1, this.id[2]]);
                    if (n) { border[3] = n.minZ; } else { skip = true; }
                }

                if (border[5] == null) {
                    n = this.map.tree.getNodeById([this.id[0], this.id[1] + 1, this.id[2]]);
                    if (n) { border[5] = n.minZ; } else { skip = true; }
                }

                if (border[6] == null) {
                    n = this.map.tree.getNodeById([this.id[0], this.id[1] - 1, this.id[2] + 1]);
                    if (n) { border[6] = n.minZ; } else { skip = true; }
                }

                if (border[7] == null) {
                    n = this.map.tree.getNodeById([this.id[0], this.id[1], this.id[2] + 1]);
                    if (n) { border[7] = n.minZ; } else { skip = true; }
                }

                if (border[8] == null) {
                    n = this.map.tree.getNodeById([this.id[0], this.id[1] + 1, this.id[2] + 1]);
                    if (n) { border[8] = n.minZ; } else { skip = true; }
                }
                
                if (skip) {
                    return;
                }

                var border2 = mnode.border2;
                
                if (!border2) {
                    mnode.border2 = [
                       (border[0] + border[1] + border[3] + border[4]) * 0.25, 
                       (border[1] + border[4]) * 0.5,
                       (border[2] + border[1] + border[5] + border[4]) * 0.25,
                       (border[3] + border[4]) * 0.5,
                        mnode.minZ,
                       (border[5] + border[4]) * 0.5,
                       (border[6] + border[7] + border[3] + border[4]) * 0.25,
                       (border[7] + border[4]) * 0.5,
                       (border[8] + border[7] + border[5] + border[4]) * 0.25
                    ];
                }
                
            }
            
            var h = this.metanode.minZ;      
            var coordsRes = [[h],[h],[h],[h],[h],[h],[h],[h]];

            coordsRes[0] = [(border[8] + border[7] + border[5] + border[4]) * 0.25];
            coordsRes[1] = [(border[2] + border[1] + border[5] + border[4]) * 0.25];
            coordsRes[2] = [(border[0] + border[1] + border[3] + border[4]) * 0.25];
            coordsRes[3] = [(border[6] + border[7] + border[3] + border[4]) * 0.25];
            coordsRes[4] = [(border[7] + border[4]) * 0.5];
            coordsRes[5] = [(border[1] + border[4]) * 0.5];

            
            if (this.map.drawFog) {
                coordsRes[6] = [(border[3] + border[4]) * 0.5];
                coordsRes[7] = [(border[5] + border[4]) * 0.5];
            }

        }
        
		

        middle[2] = h;
        middle = node.getPhysicalCoords(middle, true);
        
    } else {
        var res = map.measure.getSurfaceHeight(null, lod, null, node, middle, coords);
        middle[2] = res[0];
        middle = node.getPhysicalCoords(middle, true);
        var coordsRes = res[5];
        
        if (!coordsRes) {
            coordsRes = [[0],[0],[0],[0],[0],[0],[0],[0]];
        }
    }

    var renderer = map.renderer;
    var buffer = map.draw.planeBuffer;
    //var mvp = mat4.create();
    var mv = renderer.camera.getModelviewMatrix();
    var proj = renderer.camera.getProjectionMatrix();
    //mat4.multiply(proj, mv, mvp);

    var sx = cameraPos[0];
    var sy = cameraPos[1];
    var sz = cameraPos[2];
    
    coords[0][2] = coordsRes[0][0];
    var n1 = node.getPhysicalCoords(coords[0], true);

    coords[1][2] = coordsRes[1][0];
    var n2 = node.getPhysicalCoords(coords[1], true);

    coords[2][2] = coordsRes[2][0];
    var n3 = node.getPhysicalCoords(coords[2], true);

    coords[3][2] = coordsRes[3][0];
    var n4 = node.getPhysicalCoords(coords[3], true);

    coords[4][2] = coordsRes[4][0];
    var mtop = node.getPhysicalCoords(coords[4], true);

    coords[5][2] = coordsRes[5][0];
    var mbottom = node.getPhysicalCoords(coords[5], true);

    coords[6][2] = coordsRes[6][0];
    var mleft = node.getPhysicalCoords(coords[6], true);

    coords[7][2] = coordsRes[7][0];
    var mright = node.getPhysicalCoords(coords[7], true);

    buffer[0] = n4[0] - sx;
    buffer[1] = n4[1] - sy;
    buffer[2] = n4[2] - sz;
    
    buffer[3] = mtop[0] - sx;
    buffer[4] = mtop[1] - sy;
    buffer[5] = mtop[2] - sz;

    buffer[6] = n1[0] - sx;
    buffer[7] = n1[1] - sy;
    buffer[8] = n1[2] - sz;

    buffer[9] = mleft[0] - sx;
    buffer[10] = mleft[1] - sy;
    buffer[11] = mleft[2] - sz;
            
    buffer[12] = middle[0] - sx;
    buffer[13] = middle[1] - sy;
    buffer[14] = middle[2] - sz;
            
    buffer[15] = mright[0] - sx;
    buffer[16] = mright[1] - sy;
    buffer[17] = mright[2] - sz;
        
    buffer[18] = n3[0] - sx;
    buffer[19] = n3[1] - sy;
    buffer[20] = n3[2] - sz;
    
    buffer[21] = mbottom[0] - sx;
    buffer[22] = mbottom[1] - sy;
    buffer[23] = mbottom[2] - sz;
    
    buffer[24] = n2[0] - sx;
    buffer[25] = n2[1] - sy;
    buffer[26] = n2[2] - sz;


    if (hasPoles && !map.poleRadius && node.id[0] == 1 && !node.isPole) {
        var p = node.getPhysicalCoords([node.extents.ur[0], node.extents.ur[1], 0]);
        map.poleRadius = Math.sqrt(p[0]*p[0]+p[1]*p[1]); 
        map.poleRadiusFactor = 8 * Math.pow(2.0, 552058 / map.poleRadius); 
    }

    var factor = 1;

    if (hasPoles && node.isPole) {
        var factor = map.poleRadiusFactor; 
        var prog = renderer.progPlane2; 
        renderer.gpu.useProgram(prog, ["aPosition", "aTexCoord"]);
        prog.setVec4("uParams4", [-sx, -sy, map.poleRadius, 0]);
    } else {
        var prog = renderer.progPlane; 
        renderer.gpu.useProgram(prog, ["aPosition", "aTexCoord"]);
    }

    prog.setMat4("uMV", mv);
    prog.setMat4("uProj", proj);
    prog.setFloatArray("uPoints", buffer);
    
    /*
    var lx = (ur[0] - ll[0]);
    var ly = (ll[1] - ur[1]);
    var px = (ll[0] - node.extents.ll[0]) / lx;
    var py = (ur[1] - node.extents.ll[1]) / ly;
    
    var llx = (node.extents.ur[0] - node.extents.ll[0]) / lx;
    var lly = (node.extents.ur[1] - node.extents.ll[1]) / ly;

    px = px / llx;
    py = py / lly;
    llx = 1.0/llx;
    lly = 1.0/lly;
    
    llx *= step1;
    lly *= step1;
    px *= step1;
    py *= step1;
    */

    var step1 = node.gridStep1 * factor;

    var lx = 1.0 / (ur[0] - ll[0]);
    var ly = 1.0 / (ll[1] - ur[1]);
    var llx = step1 / ((node.extents.ur[0] - node.extents.ll[0]) * lx);
    var lly = step1 / ((node.extents.ur[1] - node.extents.ll[1]) * ly);
    var px = (ll[0] - node.extents.ll[0]) * lx * llx;
    var py = (ur[1] - node.extents.ll[1]) * ly * lly;

    prog.setVec4("uParams", [step1 * factor, this.map.fogDensity, 1/15, node.gridStep2 * factor]);
    prog.setVec4("uParams3", [(py - Math.floor(py)), (px - Math.floor(px)), lly, llx]);
    prog.setVec4("uParams2", [0, 0, node.gridBlend, 0]);

    renderer.gpu.bindTexture(renderer.heightmapTexture);
    
    //draw bbox
    renderer.planeMesh.draw(prog, "aPosition", "aTexCoord");    
}; 


export default MapSurfaceTile;


