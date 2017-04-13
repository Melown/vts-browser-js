
var MapSurfaceSequence = function(map) {
    this.map = map;
};


MapSurfaceSequence.prototype.generateSurfaceSequence = function(tree, surfaces) {
    var view = this.map.currentView;
    var tree = this.map.tree;
    
    if (!tree) {
        return;
    }
    
    tree.surfaceSequence = [];
    tree.surfaceSequenceIndices = []; //probably not used
    tree.surfaceOnlySequence = [];

    var vsurfaces = {}; 
    var vsurfaceCount = 0;
    var list = [];
    
    var strId = [];
        
    //add surfaces to the list
    for (var key in view.surfaces) {
        var surface = this.map.getSurface(key);
        
        if (surface) {
            strId.push(surface.id);
            vsurfaceCount++;
            vsurfaces[key] = surface.index + 1; //add one to avoid zero 
            //list.push(["" + (surface.index + 1), surface, true]);    
            list.push([ [(surface.index + 1)], surface, true, false]); //[surfaceId, surface, isSurface, isAlien]    
        }
    }


    if (vsurfaceCount >= 1) { //do we have virtual surface?
        strId.sort(); 
        strId = strId.join(";");

        var surface = this.map.virtualSurfaces[strId];
        if (surface) {
            list = [ [ [(surface.index + 1)], surface, true, false] ]; //[surfaceId, surface, isSurface, isAlien]    
            vsurfaceCount = 1;
        }
    }
    
    if (vsurfaceCount > 1) {
        //debugger;
        
        var glues = [];
    
        //add proper glues to the list
        for (var key in this.map.glues) {
            var glue = this.map.glues[key];
            
            //add only glue which contains desired surfaces
            var id = glue.id; 
            if (id.length <= vsurfaceCount) {
    
                var missed = false;
                for (var j = 0, lj = id.length; j < lj; j++) {
                    if (!vsurfaces[id[j]]) {
                        missed = true;
                        break;
                    }
                }
    
                if (!missed) {
                    //var listId = "";
                    var listId = [];
                    
                    //create glue id in reverse order for sorting
                    for (var j = 0, lj = id.length; j < lj; j++) {
                        //listId = vsurfaces[id[j]] + (j ? "." : "") + listId;
                        listId.unshift(vsurfaces[id[j]]);
                    }
    
                    glues.push([listId, glue, false, false]); //[surfaceId, surface, isSurface, isAlien]   
                }
            }
        }
    
        //process glue flags
        for (var i = 0, li = glues.length; i < li; i++) {
            var item = glues[i];
            var glue = item[1];
    
            glue.flagProper = true;
            glue.flagAlien = true;
    
            if (glue.flagProper) {
                list.push(item);  
            }
                    
            if (glue.flagAlien) {
                //remove first surface from id
                var listId = item[0].slice(1);
                            
                //add same glue as alien
                list.push([listId, item[1], false, true]); //[surfaceId, surface, isSurface, isAlien]   
            }
        }
    
        //debugger;
    
        //sort list alphabetically
        do {
            var sorted = true;
            
            for (var i = 0, li = list.length - 1; i < li; i++) {
                var a1 = list[i][0];
                var a2 = list[i+1][0];
                
                var lesser = false;
                
                for (var j = 0, lj = Math.min(a1.length, a2.length); j < lj; j++) {
                    if (a1[j] < a2[j] || (j == (lj -1) && a1[j] == a2[j] && a2.length > a1.length)) {
                        lesser = true;
                        break;                    
                    }
                }
                
                if (lesser) {
                    var t = list[i];
                    list[i] = list[i+1];
                    list[i+1] = t;
                    sorted = false;
                } 
            }
            
        } while(!sorted);
    
        //debugger;
    
        //return;
    
        var lastIndex = vsurfaceCount - 1;
    
        //convert list to surface sequence
        for (var i = 0, li = list.length; i < li; i++) {
            tree.surfaceSequence.push([list[i][1], list[i][3]]); //[surface, isAlien]
            //this.surfaceSequence.push(list[i][1]); 
            list[i][1].viewSurfaceIndex = lastIndex; 
            
            if (list[i][2]) {
                lastIndex--;
                tree.surfaceOnlySequence.push(list[i][1]);
            }
        }
    
        //this.generateSurfaceSequenceOld();
        
    } else {
        if (vsurfaceCount == 1) {
            tree.surfaceSequence.push([list[0][1], list[0][3]]); //[surface, isAlien]
            list[0][1].viewSurfaceIndex = vsurfaceCount - 1;
            tree.surfaceOnlySequence = [list[0][1]];
        }
    }

    this.map.freeLayersHaveGeodata = false;

    //free layers
    for (var key in view.freeLayers) {
        var freeLayer = this.map.getFreeLayer(key);
        if (freeLayer) {
            freeLayer.surfaceSequence = [freeLayer];
            freeLayer.surfaceOnlySequence = [freeLayer];
            
            if (freeLayer.geodata) {
                this.map.freeLayersHaveGeodata = true;
            }
        }
    }    

    //just in case
    this.map.renderer.draw.clearJobBuffer();
};


MapSurfaceSequence.prototype.generateBoundLayerSequence = function() {
    var view = this.map.currentView;
    var surfaces = [];
    
    //surfaces
    for (var key in view.surfaces) {
        var surfaceLayers = view.surfaces[key];
        var surface = this.map.getSurface(key);
        if (surface != null) {
            surface.boundLayerSequence = [];
            
            for (var i = 0, li = surfaceLayers.length; i < li; i++) {
                var item = surfaceLayers[i];
        
                if (typeof item === "string") {
                    var layer = this.map.getBoundLayerById(item);
                    if (layer) {
                        surface.boundLayerSequence.push([layer, 1]);
                    }
                } else {
                    var layer = this.map.getBoundLayerById(item["id"]);
                    if (layer) {

                        var alpha = 1;
                        if (typeof item["alpha"] !== "undefined") {
                            alpha = item["alpha"];
                        }

                        surface.boundLayerSequence.push([layer, alpha]);
                    }
                }
            }
        }
    }

    //free layers
    for (var key in view.freeLayers) {
        var freeLayersProperties = view.freeLayers[key];
        var freeLayer = this.map.getFreeLayer(key);
        if (freeLayer != null && freeLayer.ready) {
            freeLayer.boundLayerSequence = [];
            
            var boundLayers = freeLayersProperties["boundLayers"];
            
            if (boundLayers && Array.isArray(boundLayers)) {

                for (var i = 0, li = boundLayers.length; i < li; i++) {
                    var item = boundLayers[i];
            
                    if (typeof item === "string") {
                        var layer = this.map.getBoundLayerById(item);
                        if (layer) {
                            freeLayer.boundLayerSequence.push([layer, 1]);
                        }
                    } else {
                        var layer = this.map.getBoundLayerById(item["id"]);
                        if (layer) {
    
                            var alpha = 1;
                            if (typeof item["alpha"] !== "undefined") {
                                alpha = item["alpha"];
                            }
    
                            freeLayer.boundLayerSequence.push([layer, alpha]);
                        }
                    }
                }
            }  
        }
    }
};


export default MapSurfaceSequence;

