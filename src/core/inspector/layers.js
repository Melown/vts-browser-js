
var InspectorLayers = function(inspector) {
    this.inspector = inspector;
    this.core = inspector.core;
};


InspectorLayers.prototype.init = function() {
    var inspector = this.inspector;
    inspector.addStyle(
        "#vts-layers-panel {"
            + "font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;"
            + "display: none;"
            + "padding:15px;"
            + "font-size: 14px;"
            + "position: absolute;"
            + "right: 10px;"
            + "bottom: 10px;"
            + "cursor: default;"
            + "background-color: rgba(255,255,255,0.95);"
            + "border-radius: 5px;"
            + "border: solid 1px #ccc;"
            + "text-align: left;"
            + "z-index: 7;"
            + "padding: 10px;"
        + "}"

        + "#vts-layers-panel button {"
            + "max-width: 23px;"
            + "max-height: 21px;"
        + "}"

        + "#vts-layers-panel-title {"
            + "margin-bottom: 3px;"
        + "}"

        + "#vts-layers-views-panel {"
            + "margin-top: 5px;"
            + "float: left;"
        + "}"

        + "#vts-layers-views-items {"
            + "width: 191px;"
            + "overflow-y: scroll;"
            + "overflow-x: hidden;"
            + "height: 200px;"
            + "border: 1px solid #ddd;"
        + "}"
        
        + "#vts-layers-surfaces-panel {"
            + "margin-top: 5px;"
            + "float: left;"
        + "}"        
        
        + "#vts-layers-surfaces-items {"
            + "width: 150px;"
            + "overflow-y: scroll;"
            + "overflow-x: hidden;"
            + "height: 200px;"
            + "border-top: 1px solid #ddd;"
            + "border-bottom: 1px solid #ddd;"
        + "}"
         
        + "#vts-layers-boundlayers-panel {"
            + "margin-top: 5px;"
            + "float: left;"
        + "}"

        + "#vts-layers-boundlayers-items {"
            + "width: 250px;"
            + "overflow-y: scroll;"
            + "overflow-x: hidden;"
            + "height: 200px;"
            + "border: 1px solid #ddd;"
            + "border-right: none;"
        + "}"

        + "#vts-layers-freelayers-panel {"
            + "margin-top: 5px;"
            + "float: left;"
        + "}"

        + "#vts-layers-freelayers-items {"
            + "width: 150px;"
            + "overflow-y: scroll;"
            + "overflow-x: hidden;"
            + "height: 200px;"
            + "border: 1px solid #ddd;"
        + "}"

        + "#vts-layers-fl-properties-panel {"
            + "margin-top: 5px;"
            + "float: left;"
        + "}"

        + "#vts-layers-fl-properties-items {"
            + "width: 250px;"
            + "overflow-y: scroll;"
            + "overflow-x: hidden;"
            + "height: 200px;"
            + "border: 1px solid #ddd;"
            + "border-right: none;"
        + "}"

        + "#vts-layers-json-panel {"
            + "margin-top: 5px;"
            + "float: right;"
        + "}"

        + "#vts-layers-json-text {"
            + "width: 200px;"
            + "resize: none;"
            + "height: 180px;"
            + "border: 1px solid #ddd;"
            + "white-space: nowrap;"
            + "padding: 0px;"
        + "}"

        + "#vts-layers-json-text2 {"
            + "width: 200px;"
            + "height: 21px;"
            + "border: 1px solid #ddd;"
        + "}"
        
        + ".vts-layers-panel-title {"
            + "margin: 0px;"
            + "margin-bottom: 5px;"
        + "}"

        + ".vts-layers-item {"
            + "width: 100%;"
        + "}"        
        
        + ".vts-layers-item input[type=number]{"
            + "width: 43px;"
        + "}"
        
        + ".vts-layers-name {"
            + "width: 120px;"
            + "display: inline-block;"
            + "overflow: hidden;"
            + "text-overflow: ellipsis;"
            + "white-space: nowrap;"       
        + "}"          

        + ".vts-layers-name2 {"
            + "width: 126px;"
            + "display: inline-block;"
            + "overflow: hidden;"
            + "text-overflow: ellipsis;"
            + "white-space: nowrap;"       
        + "}"
         
        + "#vts-layers-fl-properties-style {"
            + "width: 175px;"
            + "height: 21px;"
        + "}"

        + ".vts-surface-item {"
            + "width: 100%;"
            + "overflow: hidden;"
            + "text-overflow: ellipsis;"
            + "white-space: nowrap;"    
        + "}" 
        
    );

    this.element = document.createElement("div");
    this.element.id = "vts-layers-panel";
    this.element.innerHTML = ""
        + '<div id="vts-layers-views-panel"><p class="vts-layers-panel-title">Named Views:</p>'
           + '<div id="vts-layers-views-items"></div></div>'
        + '<div id="vts-layers-surfaces-panel"><p class="vts-layers-panel-title">Surfaces:</p>'
           + '<div id="vts-layers-surfaces-items"></div></div>'
        + '<div id="vts-layers-boundlayers-panel"><p class="vts-layers-panel-title">Surface Bound Layers:</p>'
           + '<div id="vts-layers-boundlayers-items"></div></div>'
        + '<div id="vts-layers-freelayers-panel"><p class="vts-layers-panel-title">Free Layers:</p>'
           + '<div id="vts-layers-freelayers-items"></div></div>'
        + '<div id="vts-layers-fl-properties-panel"><p class="vts-layers-panel-title">Free Layer Properties:</p>'
           + '<div id="vts-layers-fl-properties-items"></div></div>'
        + '<div id="vts-layers-json-panel"><p class="vts-layers-panel-title">Definition:</p>'
           + '<textarea id="vts-layers-json-text" cols="48"></textarea><br/>'
           + '<input id="vts-layers-json-text2" type="text"></div>';

    this.core.element.appendChild(this.element);
    this.viewItems = document.getElementById("vts-layers-views-items");
    this.surfacesItems = document.getElementById("vts-layers-surfaces-items");
    this.boundLayersItems = document.getElementById("vts-layers-boundlayers-items");
    this.freeLayersItems = document.getElementById("vts-layers-freelayers-items");
    this.freeLayersPropertiesItems = document.getElementById("vts-layers-fl-properties-items");
    this.jsonText = document.getElementById("vts-layers-json-text");
    this.jsonText2 = document.getElementById("vts-layers-json-text2");

    this.element.addEventListener("mouseup", inspector.doNothing.bind(this), true);
    this.element.addEventListener("mousedown", inspector.doNothing.bind(this), true);
    this.element.addEventListener("mousewheel", inspector.doNothing.bind(this), false);
    this.element.addEventListener("dblclick", inspector.doNothing.bind(this), false);

    this.views = [];
    
    this.panelVisible = false;
    this.panelInitialized = false;
    this.currentView = "";
    this.currentSurface = "";
    this.currentFreeLayer = "";
};


InspectorLayers.prototype.initViews = function() {
    var map = this.core.getMap();
    if (!map) {
        return;
    }

    var views = map.getNamedViews();
    var id = "--initial--";
    this.views[id] = {
            surfaces : {},
            freeLayers : {},
            original : JSON.parse(JSON.stringify(map.getView()))
        };

    for (var i = 0, li = views.length; i < li; i++) {
        var view = views[i];
        this.views[view] = {
            surfaces : {},
            freeLayers : {},
            original : JSON.parse(JSON.stringify(map.getNamedView(view).getInfo()))
        };
    }
    
    this.currentView = id;
    var views = this.views;
    
    for (var key in views) {
        var view = views[key];
        var surfaces = map.getSurfaces();   
        
        for (var i = 0, li = surfaces.length; i < li; i++) {
            var id = surfaces[i];
            var surface = map.getSurface(id);
            var layers = map.getBoundLayers();
            var states = []; 
    
            for (var j = 0, lj = layers.length; j < lj; j++) {
                var layer = map.getBoundLayerById(layers[j]);
                
                states.push({
                    id : layers[j],
                    alpha : 100,
                    enabled : false
                });
            }
            
            view.surfaces[id] = {
                enabled : false,
                layers : states 
            };
        }         

        var freeLayers = map.getFreeLayers();   
        
        for (var i = 0, li = freeLayers.length; i < li; i++) {
            var id = freeLayers[i];

            var layers = map.getBoundLayers();
            var states = []; 
    
            for (var j = 0, lj = layers.length; j < lj; j++) {
                var layer = map.getBoundLayerById(layers[j]);
                
                states.push({
                    id : layers[j],
                    alpha : 100,
                    enabled : false
                });
            }
            
            var freeLayer = map.getFreeLayer(id);
            var freeLayerInfo = freeLayer.getInfo(); 
            
            view.freeLayers[id] = {
                enabled : false,
                style : null,
                originalStyle : freeLayerInfo["style"],
                depthShift : 0,
                layers : states 
            };
        }
        
        var viewSurfaces = view.original["surfaces"];
        
        for (var skey in viewSurfaces) {
            var layers = viewSurfaces[skey];
            
            if (view.surfaces[skey]) {
                var surface = view.surfaces[skey]; 
                surface.enabled = true;

                for (var i = 0, li = layers.length; i < li; i++) {
                    if (typeof layers[i] === "string") {
                        var index = this.findIdInArray(surface.layers, layers[i]);
                        if (index != -1 && surface.layers[index]) {
                            surface.layers[index].enabled = true;
                            surface.layers.splice(i, 0, surface.layers.splice(index, 1)[0]);
                        }    
                    } else {
                        var id = layers[i]["id"];
                        var index = this.findIdInArray(surface.layers, id);
                        if (index != -1 && surface.layers[index]) {
                            surface.layers[index].enabled = true;
                            surface.layers[index].alpha = layers[i]["alpha"] ? (parseFloat(layers[i]["alpha"])*100) : 100;
                            surface.layers.splice(i, 0, surface.layers.splice(index, 1)[0]);
                        }    
                    }
                }
            }
        }

        var viewfreeLayers = view.original["freeLayers"];
        
        for (var skey in viewfreeLayers) {
            var freeLayerProperties = viewfreeLayers[skey];
            
            if (view.freeLayers[skey]) {
                var freeLayer = view.freeLayers[skey]; 
                freeLayer.enabled = true;
                freeLayer.depthShift = freeLayerProperties["depthShift"] || 0;
                freeLayer.depthShift *= 100;
                freeLayer.style = freeLayerProperties["style"];
                //freeLayer.originalStyle = freeLayer.style;
                
                var layers = [];
                freeLayer.layers = layers;
                
                for (var i = 0, li = layers.length; i < li; i++) {
                    if (typeof layers[i] === "string") {
                        var index = this.findIdInArray(freeLayer.layers, layers[i]);
                        if (index != -1 && freeLayer.layers[index]) {
                            freeLayer.layers[index].enabled = true;
                            freeLayer.layers.splice(i, 0, freeLayer.layers.splice(index, 1)[0]);
                        }    
                    } else {
                        var id = layers[i]["id"];
                        var index = this.findIdInArray(freeLayer.layers, id);
                        if (index != -1 && surface.layers[index]) {
                            freeLayer.layers[index].enabled = true;
                            freeLayer.layers[index].alpha = layers[i]["alpha"] ? (parseFloat(layers[i]["alpha"])*100) : 100;
                            freeLayer.layers.splice(i, 0, surface.layers.splice(index, 1)[0]);
                        }    
                    }
                }
                
            }
        }        
    }
};


InspectorLayers.prototype.findIdInArray = function(array, id) {
    for (var i = 0, li = array.length; i < li; i++) {
        if (array[i].id == id) {
            return i;
        } 
    }
    
    return -1;
};


InspectorLayers.prototype.buildViews = function() {
    var map = this.core.getMap();
    if (!map) {
        return;
    }

    var views = this.views;
    var html = "";

    for (var key in views) {
        html += '<div class="vts-views-item" id="vts-views-item-' + key + '">'
                 + '<div class="vts-layers-name2">' + key + '</div>'
                 + '<button id="vts-views-cbutton-' + key + '" type="button" title="Clone">C</button>' 
                 + '<button id="vts-views-xbutton-' + key + '" type="button" title="Remove">X</button>' 
                 + '</div>';
    }

    this.viewItems.innerHTML = html;

    for (var key in views) {
        htmlId = "vts-views-cbutton-" + key;
        document.getElementById(htmlId).onclick = this.switchView.bind(this, key, htmlId, "clone");
        htmlId = "vts-views-xbutton-" + key;
        document.getElementById(htmlId).onclick = this.switchView.bind(this, key, htmlId, "remove");
        var htmlId = "vts-views-item-" + key;
        document.getElementById(htmlId).onclick = this.selectView.bind(this, key);
    }
};


InspectorLayers.prototype.buildSurfaces = function() {
    var view = this.views[this.currentView];
    var surfaces = view.surfaces;
    var html = "";
    var firstKey = null;
    
    for (var key in surfaces) {
        html += '<div id="vts-surface-item-' + key + '" class="vts-surface-item"><input id="vts-surface-checkbox-'
                 + key + '" type="checkbox"/><span title=' + key + '>' + key + '</span></div>';
                 
        if (firstKey === null) {
            firstKey = key;
        }
    }

    this.surfacesItems.innerHTML = html;
    this.currentSurface = firstKey;

    for (var key in surfaces) {
        if (surfaces[key].enabled) {
            var htmlId = "vts-surface-checkbox-" + key;
            document.getElementById(htmlId).checked = true;
        }
    }

    for (var key in surfaces) {
        var htmlId = "vts-surface-checkbox-" + key;
        document.getElementById(htmlId).onchange = this.switchSurface.bind(this, key, htmlId);
        var htmlId = "vts-surface-item-" + key;
        document.getElementById(htmlId).onclick = this.selectSurface.bind(this, key);
    }
};


InspectorLayers.prototype.buildBoundLayers = function(id) {
    var view = this.views[this.currentView];
    var layers = view.surfaces[id].layers;
    var html = "";

    for (var i = 0, li = layers.length; i < li; i++) {
        var layer = layers[i];

        html += '<div class="vts-layers-item"><input id="vts-boundlayer-checkbox-' + layer.id + '" type="checkbox" ' + (layer.enabled ? "checked" : "")   + '/>'
                 + '<div class="vts-layers-name">' + layer.id + '</div>'
                 + '<input id="vts-boundlayer-spinner-' + layer.id + '" type="number" title="Alpha" min="0" max="100" step="10" value="' + layer.alpha + '">'
                 + '<button id="vts-boundlayer-ubutton-' + layer.id + '" type="button" title="Move Above">&uarr;</button>' 
                 + '<button id="vts-boundlayer-dbutton-' + layer.id + '" type="button" title="Move Bellow">&darr;</button>' 
                 + '</div>';
    }

    this.boundLayersItems.innerHTML = html;

    for (var i = 0, li = layers.length; i < li; i++) {
        var htmlId = "vts-boundlayer-checkbox-" + layers[i].id;
        document.getElementById(htmlId).onchange = this.switchBoundLayer.bind(this, layers[i].id, htmlId, "enable");
        htmlId = "vts-boundlayer-spinner-" + layers[i].id;
        document.getElementById(htmlId).onchange = this.switchBoundLayer.bind(this, layers[i].id, htmlId, "alpha");
        htmlId = "vts-boundlayer-ubutton-" + layers[i].id;
        document.getElementById(htmlId).onclick = this.switchBoundLayer.bind(this, layers[i].id, htmlId, "up");
        htmlId = "vts-boundlayer-dbutton-" + layers[i].id;
        document.getElementById(htmlId).onclick = this.switchBoundLayer.bind(this, layers[i].id, htmlId, "down");
    }
};


InspectorLayers.prototype.buildFreeLayers = function() {
    var view = this.views[this.currentView];
    var layers = view.freeLayers;
    var html = "";

    for (var key in layers) {
        var layer = layers[key];
        html += '<div class="vts-surface-item" id="vts-freelayer-item-' + key
                  + '"><input id="vts-freelayer-checkbox-' + key + '" type="checkbox" '
                  + (layers[key].enabled ? "checked" : "") + '/><span title=' + key + '>' + key + '</span></div>';
    }

    this.freeLayersItems.innerHTML = html;

    for (var key in layers) {
        var htmlId = "vts-freelayer-checkbox-" + key;
        document.getElementById(htmlId).onchange = this.switchFreeLayer.bind(this, key, htmlId);
        var htmlId = "vts-freelayer-item-" + key;
        document.getElementById(htmlId).onclick = this.selectFreeLayer.bind(this, key);
    }
};


InspectorLayers.prototype.buildFreeLayerProperties = function(id) {
    var map = this.core.getMap();
    var view = this.views[this.currentView];
    var layers = view.freeLayers[id].layers;
    var html = "";
    
    if (!map || !map.getFreeLayer(id)) {
        return;
    }

    var layerInfo = map.getFreeLayer(id).getInfo();
    var layerType = layerInfo["type"]; 

    switch(layerType) {
        case "mesh":
        case "mesh-tiles":

            html += '<div class="vts-layers-item"><div class="vts-layers-name" style="width:185px">' + "DepthShift:" + '</div>'
                     + '<input id="vts-fl-properties-depth-shift" type="number" min="-100" max="100" step="1" value="' + view.freeLayers[id].depthShift + '">'
                     + '</div>';
    
            html += '<div class="vts-layers-item"><div class="vts-layers-name">' + "BoundLayers:" + '</div></div>';
        
            for (var i = 0, li = layers.length; i < li; i++) {
                var layer = layers[i];
        
                html += '<div class="vts-layers-item"><input id="vts-fl-properties-checkbox-' + layer.id + '" type="checkbox" ' + (layer.enabled ? "checked" : "")   + '/>'
                         + '<div class="vts-layers-name">' + layer.id + '</div>'
                         + '<input id="vts-fl-properties-spinner-' + layer.id + '" type="number" title="Alpha" min="0" max="100" step="10" value="' + layer.alpha + '">'
                         + '<button id="vts-fl-properties-ubutton-' + layer.id + '" type="button" title="Move Above">&uarr;</button>' 
                         + '<button id="vts-fl-properties-dbutton-' + layer.id + '" type="button" title="Move Bellow">&darr;</button>' 
                         + '</div>';
            }
        
            this.freeLayersPropertiesItems.innerHTML = html;
    
            var htmlId = "vts-fl-properties-depth-shift";
            document.getElementById(htmlId).onchange = this.switchFreeLayerProperty.bind(this, htmlId, "depthShift");
        
            for (var i = 0, li = layers.length; i < li; i++) {
                var htmlId = "vts-fl-properties-checkbox-" + layers[i].id;
                document.getElementById(htmlId).onchange = this.switchFreeLayerBoundLayer.bind(this, layers[i].id, htmlId, "enable");
                htmlId = "vts-fl-properties-spinner-" + layers[i].id;
                document.getElementById(htmlId).onchange = this.switchFreeLayerBoundLayer.bind(this, layers[i].id, htmlId, "alpha");
                htmlId = "vts-fl-properties-ubutton-" + layers[i].id;
                document.getElementById(htmlId).onclick = this.switchFreeLayerBoundLayer.bind(this, layers[i].id, htmlId, "up");
                htmlId = "vts-fl-properties-dbutton-" + layers[i].id;
                document.getElementById(htmlId).onclick = this.switchFreeLayerBoundLayer.bind(this, layers[i].id, htmlId, "down");
            }
            
            break;

        case "geodata":
        case "geodata-tiles":

            html += '<div class="vts-layers-item"><div class="vts-layers-name" style="width:50px">' + "Style:" + '</div>'
                    + '<select id="vts-layers-fl-properties-style">';
                    
            var styles = map.getStylesheets();
            var index = styles.indexOf(view.freeLayers[id].style || view.freeLayers[id].originalStyle); // || layerInfo["style"]); 
            
            for (var i = 0, li = styles.length; i < li; i++) {
                html += '<option value="' + styles[i] + '" ' + ((i == index) ? "selected" : "") + '>' + styles[i] + '</option>';
            }
                    
            html += '</select>'
                    + '</div>';

            this.freeLayersPropertiesItems.innerHTML = html;

            var htmlId = "vts-layers-fl-properties-style";
            document.getElementById(htmlId).onchange = this.switchFreeLayerProperty.bind(this, htmlId, "style");
       
            break;
    }
};


InspectorLayers.prototype.selectView = function(id) {
    if (!this.views[id]) {
        return;
    }

    //deselect previous
    if (this.currentView) {
        var element = document.getElementById("vts-views-item-" + this.currentView);
        if (element) {
            element.style.backgroundColor = "initial";
        }
    }

    //select new one
    var element = document.getElementById("vts-views-item-" + id);
    element.style.backgroundColor = "#ddd";
    this.currentView = id;
    //this.buildBoundLayers(this.currentSurface);

    this.buildSurfaces();
    this.selectSurface(this.currentSurface);
    this.buildFreeLayers();
    this.applyMapView();
};


InspectorLayers.prototype.switchView = function(id, htmlId, action) {
    var element = document.getElementById(htmlId);
    var views = this.views;
    
    for (var key in this.views) {
        if (key == id) {
            switch(action) {
                case "clone":
                    //layers[i].enabled = element.checked;
                    var i = 2;
                    
                    while(true) {
                        if (!views[id + " #" + i]) {
                            views[id + " #" + i] = JSON.parse(JSON.stringify(views[id]));
                            break;
                        } 
                        i++;
                    }
                
                    this.buildViews();
                    
                    break;
                case "remove":
                
                    var count = 0;
                
                    for (var key in views) {
                        count++;
                    }
                
                    if (count > 1) {
                        delete views[id];
                        this.buildViews();

                        if (this.currentView == id) {
                            for (var key in views) {
                                this.selectView(key);
                                break;
                            }
                        } else {
                            this.selectView(this.currentView);
                        }
                    }
                    
                    break;
            }
            
            break;
        }
    }
};


InspectorLayers.prototype.switchSurface = function(id, htmlId) {
    var element = document.getElementById(htmlId);
    var view = this.views[this.currentView];
    view.surfaces[id].enabled = element.checked;
    this.applyMapView();
};


InspectorLayers.prototype.selectSurface = function(id, htmlId) {
    //deselect previous
    if (this.currentSurface) {
        var element = document.getElementById("vts-surface-item-" + this.currentSurface);
        element.style.backgroundColor = "initial";
    }

    //select new one
    var element = document.getElementById("vts-surface-item-" + id);
    element.style.backgroundColor = "#ddd";
    this.currentSurface = id;
    this.buildBoundLayers(this.currentSurface);
};


InspectorLayers.prototype.switchBoundLayer = function(id, htmlId, action) {
    var element = document.getElementById(htmlId);
    var view = this.views[this.currentView];
    var layers = view.surfaces[this.currentSurface].layers;
    
    for (var i = 0, li = layers.length; i < li; i++) {
        if (layers[i].id == id) {
            switch(action) {
                case "enable":
                    layers[i].enabled = element.checked;
                    break;
                case "alpha":
                    layers[i].alpha = parseInt(element.value, 10);
                    break;
                case "up":
                    layers.splice(Math.max(0,i-1), 0, layers.splice(i, 1)[0]);
                    this.selectSurface(this.currentSurface);
                    break;
                case "down":
                    layers.splice(Math.max(0,i+1), 0, layers.splice(i, 1)[0]);
                    this.selectSurface(this.currentSurface);
                    break;
            }
            
            break;
        }
    }
    
    this.applyMapView();
};


InspectorLayers.prototype.switchFreeLayer = function(id, htmlId) {
    var element = document.getElementById(htmlId);
    var view = this.views[this.currentView];
    view.freeLayers[id].enabled = element.checked;
    this.applyMapView();
};


InspectorLayers.prototype.selectFreeLayer = function(id, htmlId) {
    //deselect previous
    if (this.currentFreeLayer) {
        var element = document.getElementById("vts-freelayer-item-" + this.currentFreeLayer);
        element.style.backgroundColor = "initial";
    }

    //select new one
    var element = document.getElementById("vts-freelayer-item-" + id);
    element.style.backgroundColor = "#ddd";
    this.currentFreeLayer = id;
    this.buildFreeLayerProperties(this.currentFreeLayer);
};


InspectorLayers.prototype.switchFreeLayerBoundLayer = function(id, htmlId, action) {
    var element = document.getElementById(htmlId);
    var view = this.views[this.currentView];
    var layers = view.freeLayers[this.currentFreeLayer].layers;
    
    for (var i = 0, li = layers.length; i < li; i++) {
        if (layers[i].id == id) {
            switch(action) {
                case "enable":
                    layers[i].enabled = element.checked;
                    break;
                case "alpha":
                    layers[i].alpha = parseInt(element.value, 10);
                    break;
                case "up":
                    layers.splice(Math.max(0,i-1), 0, layers.splice(i, 1)[0]);
                    this.selectFreeLayer(this.currentFreeLayer);
                    break;
                case "down":
                    layers.splice(Math.max(0,i+1), 0, layers.splice(i, 1)[0]);
                    this.selectFreeLayer(this.currentFreeLayer);
                    break;
            }
            
            break;
        }
    }
    
    this.applyMapView();
};


InspectorLayers.prototype.switchFreeLayerProperty = function(htmlId, action) {
    var element = document.getElementById(htmlId);
    var view = this.views[this.currentView];
    var layer = view.freeLayers[this.currentFreeLayer];

    switch(action) {
        case "depthShift":
            layer.depthShift = parseInt(element.value, 10);
            break;
        case "style":
            layer.style = element.value;
            break;
    }
    
    this.applyMapView();
};


InspectorLayers.prototype.applyMapView = function(jsonOnly) {
    var view = {
        "surfaces" : {},
        "freeLayers" : {}
    };

    var sourceView = this.views[this.currentView];
    var surfaces = sourceView.surfaces;
    
    for (var key in surfaces) {
        if (surfaces[key].enabled) {
            var surfaceBoundLayers = [];
            var layers = surfaces[key].layers; //bound layers
            
            for (var i = 0, li = layers.length; i < li; i++) {
                if (layers[i].enabled) {
                    
                    if (layers[i].alpha < 100) {
                        surfaceBoundLayers.push({"id":layers[i].id, "alpha":(layers[i].alpha*0.01).toFixed(2)});
                    } else {
                        surfaceBoundLayers.push(layers[i].id);
                    }
                }
            }
            
            view["surfaces"][key] = surfaceBoundLayers;
        }
    }

    var freeLayers = sourceView.freeLayers;
    
    for (var key in freeLayers) {
        if (freeLayers[key].enabled) {
            var freeLayerBoundLayers = [];
            var layers = freeLayers[key].layers; //bound layers
            
            for (var i = 0, li = layers.length; i < li; i++) {
                if (layers[i].enabled) {
                    
                    if (layers[i].alpha < 100) {
                        freeLayerBoundLayers.push({"id":layers[i].id, "alpha":parseFloat((layers[i].alpha*0.01).toFixed(2))});
                    } else {
                        freeLayerBoundLayers.push(layers[i].id);
                    }
                }
            }
            
            view["freeLayers"][key] = {};
            
            if (freeLayerBoundLayers.length > 0) {
                view["freeLayers"][key]["boundLayers"] = freeLayerBoundLayers;
            }

            if (freeLayers[key].style && freeLayers[key].style != freeLayers[key].originalStyle) {
                view["freeLayers"][key]["style"] = freeLayers[key].style;
            }
            
            if (freeLayers[key].depthShift != 0) {
                view["freeLayers"][key]["depthShift"] = parseFloat((freeLayers[key].depthShift*0.01).toFixed(2));
            } 
            
        }
    }

    this.jsonText.value = JSON.stringify(view, null, "  ");
    this.jsonText2.value = encodeURIComponent(JSON.stringify(view));

    if (!jsonOnly) {
        var map = this.core.getMap();
        if (!map) {
            return;
        }
        
        map.setView(view);
    }
};


InspectorLayers.prototype.showPanel = function() {
    this.element.style.display = "block";
    this.panelVisible = true;
    this.updatePanel();
};


InspectorLayers.prototype.hidePanel = function() {
    this.element.style.display = "none";
    this.panelVisible = false;
};


InspectorLayers.prototype.switchPanel = function() {
    if (this.panelVisible) {
        this.hidePanel();
    } else {
        this.showPanel();
    }
};


InspectorLayers.prototype.updatePanel = function(Layers) {
    if (!this.panelInitialized) {
        this.panelInitialized = false;
        this.initViews();
        this.buildViews();
        this.selectView(this.currentView);
        /*
        this.buildSurfaces();
        this.selectSurface(this.currentSurface);
        this.buildFreeLayers();
        this.applyMapView(true);
        */
    }
};


export default InspectorLayers;
