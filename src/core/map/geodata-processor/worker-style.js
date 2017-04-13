
import {globals as globals_} from "./worker-globals.js";

//get rid of compiler mess
var globals = globals_;


var getLayer = function(layerId, featureType, index) {
    var layer = globals.stylesheetData.layers[layerId];
    if (layer == null) {
        logError("wrong-Layer", layerId, null, null, index, featureType);
        return {};
    } else {
        return layer;
    }
};


var getLayerExpresionValue = function(layer, value, feature, lod) {

    switch(typeof value) {
        case "string":

            if (value.length > 0) {
                //is it feature property?
                switch (value.charAt(0)) {

                    case "$":
                        var finalValue = feature.properties[value.substr(1)];
                        if (typeof finalValue == "undefined") {
                            logError("wrong-expresion", layer["$$layer-id"], value, value, null, "feature-property");
                        }
                        
                        return finalValue;
                }
            }

            break;
    }
    
    return value;
};


var getLayerPropertyValue = function(layer, key, feature, lod) {
    var value = layer[key];

    switch(typeof value) {
        case "string":

            if (value.length > 0) {
                //is it feature property?
                if (value.charAt(0) == "$") {
                    var finalValue = feature.properties[value.substr(1)];
                    if (finalValue != null) {
                        return finalValue;
                    } else {
                        logError("wrong-object", layer["$$layer-id"], key, value, null, "feature-property");
                        getDefaultLayerPropertyValue(key);
                    }
                }
            }

            return value;

            break;

        case "object":

            //is it null?
            if (value == null) {
                return getDefaultLayerPropertyValue(key);
            }

            //is it array (rgb, rgba, vec2)?
            if (Array.isArray(value) == true) {

                if (key == "icon-source" && globals.stylesheetBitmaps[value[0]] == null) {
                    logError("wrong-object", layer["$$layer-id"], key, value, null, "bitmap");
                    return getDefaultLayerPropertyValue(key);
                }

                return value;
            }

            //debugger

            var stops = null;
            var lodScaledArray = null;

            if (value["lod-scaled"] != null) {
                var array = value["lod-scaled"];

                if ((typeof array[1]) == "number") {
                    return array[1] * Math.pow(2*array[2], array[0] - lod);
                }

                stops = array[1];
                lodScaledArray = array;

            } else {
                stops = value["discrete"] || value["linear"];
            }

            var lastLod = stops[0][0];
            var lastValue = stops[0][1];
            var valueType = (typeof lastValue);
            var newValue = lastValue;

            for (var i = 0, li = stops.length; i <= li; i++) {

                if (i == li) {
                    newValue = lastValue;
                    break;
                }

                if (stops[i][0] > lod) {

                    if (value["discrete"] != null || lodScaledArray != null) { //no interpolation
                        newValue = lastValue;
                        break;
                    } else { //interpolate

                        currentLod = stops[i][0];
                        currentValue = stops[i][1];

                        if (currentLod == lastLod) { //end of array no interpolation needed
                            break;
                        }

                        switch(valueType) {

                            case "boolean":
                                lastValue = lastValue ? 1 : 0;
                                currentValue = lastValue ? 1 : 0;
                                var newValue = lastValue + (currentValue - lastValue) * ((lod - lastLod) / (currentLod - lastLod));

                                newValue = newValue > 0.5 ? true : false;
                                break;

                            case "number":

                                //debugger
                                var newValue = lastValue + (currentValue - lastValue) * ((lod - lastLod) / (currentLod - lastLod));
                                break;

                            case "object":
                                var newValue = [];

                                for (var j = 0, lj= lastValue.length; j < lj; j++) {
                                    newValue[j] = lastValue[j] + (currentValue[j] - lastValue[j]) * ((lod - lastLod) / (currentLod - lastLod));
                                }

                                break;
                        }

                        break;
                    }
                }

                lastLod = stops[i][0];
                lastValue = stops[i][1];
            }

            if (lodScaledArray != null) {
                newValue *= Math.pow(2*lodScaledArray[2], lodScaledArray[0] - lod);
            }

            return newValue;

            break;

        case "number":
        case "boolean":
            return value;
    }

    return getDefaultLayerPropertyValue(key);
};


var inheritLayer = function(layerId, layer, layerData, stylesheetLayersData, depth) {
    if (depth > 100) {
        logError("custom", "infinite inherit loop in Layer: " + layerId);
        return;
    }

    //do we need inherite Layer?
    if (layerData["inherit"] != null) {
        //get inherited Layer
        var LayerToInherit = stylesheetLayersData["layers"][layerData["inherit"]];

        if (LayerToInherit != null) {

            if (LayerToInherit["inherit"] != null) {
                inheritLayer(layerData["inherit"], layer, LayerToInherit, stylesheetLayersData, depth++);
            }

            //copy inherited Layer properties
            for (var key in LayerToInherit) {
                layer[key] = LayerToInherit[key];
            }
        } else {
            logError("wrong-object", layerId, "inherit", LayerToInherit, "Layer");
            return getDefaultLayerPropertyValue(key);
        }
    }
};


var copyLayer = function(layerId, layer, layerData, stylesheetLayersData) {
    //do we need inherite Layer?
    if (layerData["inherit"] != null) {
        inheritLayer(layerId, layer, layerData, stylesheetLayersData, 0);
    }

    //copy Layer properties
    //if inherited properties are present then they will be overwriten
    for (var key in layerData) {
        layer[key] = layerData[key];
    }

    //store layer id
    layer["$$layer-id"] = layerId;
};


var logError = function(errorType, layerId, key, value, index, subkey) {
    if ((typeof value) == "object") {
        value = JSON.stringify(value);
    }
    
    var str = null;

    switch(errorType) {
        case "wrong-property-value":
            str = "Error: wrong layer property " + (subkey ? ("'" + subkey + "'") : "") + ": " + layerId + "." + key + " = " + value;
            break;

        case "wrong-property-value[]":
            str = "Error: wrong layer property " + (subkey ? ("'" + subkey + "'") : "") + "["+index+"]: " + layerId + "." + key + " = " + value;
            break;

        case "wrong-object":
            str = "Error: reffered "+ subkey + " does not exist: " + layerId + "." + key + " = " + value;
            break;

        case "wrong-object[]":
            str = "Error: reffered "+ subkey + " does not exist: " + layerId + "." + key + "["+index+"] = " + value;
            break;

        case "wrong-Layer":
            str = "Error: reffered "+ subkey + " Layer does not exist: " + subkey + "["+index+"].Layer = " + layerId;
            break;

        case "wrong-bitmap":
            str = "Error: wrong definition of bitmap: " + layerId;
            break;

        case "custom":
            str = "Error: " + layerId;
            break;
    }
    
    if (str) {
        console.log(str);
    }
};


var validateValue = function(layerId, key, value, type, arrayLength, min, max) {
    //check interpolator
    if (value != null && (typeof value) == "object" && (value["discrete"] != null || value["linear"] != null || value["lod-scaled"] != null)) {

        var stops = null;
        var lodScaled = false;

        if (value["lod-scaled"] != null) {

            var array = value["lod-scaled"];

            if (!((typeof array) == "object" && Array.isArray(array) && array.length >= 2)) {
                logError("wrong-property-value", layerId, key, value, null, "[]");
                return getDefaultLayerPropertyValue(key);
            }

            if (array[2] == null) {
                array[2] = 1;
            }

            if (!((typeof array[0]) == "number" && (typeof array[2]) == "number")) {
                logError("wrong-property-value", layerId, key, value, null, "[]");
                return getDefaultLayerPropertyValue(key);
            }

            if ((typeof array[1]) == "number") {
                return value;
            }

            stops = array[1];
            lodScaled = true;

        } else {
            stops = value["discrete"] || value["linear"];
        }

        //if stops exist then check if they are array
        if (stops == null || !((typeof stops) == "object" && Array.isArray(stops) && stops.length > 0)) {
            logError("wrong-property-value", layerId, key, value, null, "[]");
            return getDefaultLayerPropertyValue(key);
        }


        //validate stops values
        if (stops != null) {
            var stopsValueType = null;

            for (var i = 0, li = stops.length; i < li; i++) {
                var stopItem = stops[i];

                //is stop array[2]?
                if(!(stopItem != null && (typeof stopItem) == "object" && Array.isArray(stopItem) && stopItem.length != 2)) {

                    //store fist stop type
                    if (stopsValueType == null) {
                        stopsValueType = typeof stopItem[1];

                        if (lodScaled == true && stopsValueType != "number") {
                            logError("wrong-property-value[]", layerId, key, value, i, "[]");
                            return getDefaultLayerPropertyValue(key);
                        }
                    }

                    //check lod value and type of value
                    if(!((typeof stopItem[0]) == "number" && (typeof stopItem[1]) == stopsValueType)) {
                        logError("wrong-property-value[]", layerId, key, value, i, "[]");
                        return getDefaultLayerPropertyValue(key);
                    }

                    //check number value
                    if (stopsValueType == "number") {
                        if (stopItem[1] > max || stopItem[1] < min) {
                            logError("wrong-property-value[]", layerId, key, value, i, "[]");
                            return getDefaultLayerPropertyValue(key);
                        }
                    }
                }
            }
        }


        return value;
    }

    //console.log("validate."+layerId+"."+key+"."+value);

    //check value type
    if ((typeof value) != type) {
        //check for exceptions
        if (!(value === null && (key == "icon-source" || key == "visibility"))) {
            logError("wrong-property-value", layerId, key, value);
            return getDefaultLayerPropertyValue(key);
        }
    }

    //check value
    switch(typeof value) {

        case "object":

            //accepted cases for null value
            if (value === null && (key == "line-style-texture" || key == "icon-source" || key == "visibility" || key == "next-pass")) {
                return value;
            }

            //check multipasss
            if (key == "next-pass") {
                if (Array.isArray(value) == true && value.length > 0) {

                    for (var i = 0; i < li; i++) {
                        var valueItem = value[i];

                        if (typeof valueItem == "object" &&
                            Array.isArray(valueItem) == true &&
                            valueItem.length == 2 &&
                            typeof valueItem[0] == "number" &&
                            typeof valueItem[1] == "string") {

                            if (stylesheetLayersData["layers"][valueItem[1]] == null) {

                            }

                        } else {
                            logError("wrong-property-value[]", layerId, key, value, i);
                            return getDefaultLayerPropertyValue(key);
                        }
                    }

                } else {
                    logError("wrong-property-value", layerId, key, value);
                    return getDefaultLayerPropertyValue(key);
                }
            }

            //check array
            if (arrayLength != null) {
                if (Array.isArray(value) == true && value.length == arrayLength) {

                    //validate array values
                    var i = 0;

                    if (key == "icon-source" || key == "line-style-texture") {
                        if (typeof value[0] != "string") {
                            logError("wrong-property-value[]", layerId, key, value, 0);
                            return getDefaultLayerPropertyValue(key);
                        }

                        if (globals.stylesheetBitmaps[value[0]] == null) {
                            logError("wrong-object", layerId, key, value, null, "bitmap");
                            return getDefaultLayerPropertyValue(key);
                        }

                        i = 1;
                    }

                    for (li = value.length; i < li; i++) {
                        if (typeof value[i] != "number") {
                            logError("wrong-property-value[]", layerId, key, value, i);
                            return getDefaultLayerPropertyValue(key);
                        }
                    }

                    return value;
                } else {
                    logError("wrong-property-value", layerId, key, value);
                    return getDefaultLayerPropertyValue(key);
                }
            }

            return value;

        case "string":

            //validate line Layer enum
            if (key == "line-style") {
                switch(value) {
                    case "solid":
                    case "texture": return value;
                    default:
                        logError("wrong-property-value", layerId, key, value);
                        return getDefaultLayerPropertyValue(key);
                }
            }

            //validate origin enum
            if (key == "label-origin" || key == "icon-origin") {
                switch(value) {
                    case "top-left":
                    case "top-right":
                    case "top-center":
                    case "center-left":
                    case "center-right":
                    case "center-center":
                    case "bottom-left":
                    case "bottom-right":
                    case "bottom-center":   return value;
                    default:
                        logError("wrong-property-value", layerId, key, value);
                        return getDefaultLayerPropertyValue(key);
                }
            }

            //validate align enum
            if (key == "label-align") {
                switch(value) {
                    case "left":
                    case "right":
                    case "center":  return value;
                    default:
                        logError("wrong-property-value", layerId, key, value);
                        return getDefaultLayerPropertyValue(key);
                }
            }

            return value;

        case "number":

            //console.log("num2");

            if (value > max || value < min) {
                logError("wrong-property-value", layerId, key, value);
                return getDefaultLayerPropertyValue(key);
            }

            //console.log("num3");

            return value;

        case "boolean":
            return value;
    }
};


var validateLayerPropertyValue = function(layerId, key, value) {
    //console.log("vall:"+layerId+"."+key+"."+value);
    //debugger;

    switch(key) {
       //case "filter" :    return validateValue(layerId, key, value, "string"); break;

       case "inherit" :    return validateValue(layerId, key, value, "string"); break;

       case "line":        return validateValue(layerId, key, value, "boolean"); break;
       case "line-flat":   return validateValue(layerId, key, value, "boolean"); break;
       case "line-width":  return validateValue(layerId, key, value, "number", null, 0.0001, Number.MAXVALUE); break;
       case "line-color":  return validateValue(layerId, key, value, "object", 4, 0, 255); break;
       case "line-style":  return validateValue(layerId, key, value, "string"); break;
       case "line-style-texture":    return validateValue(layerId, key, value, "object", 3, -Number.MAXVALUE, Number.MAXVALUE); break;
       case "line-style-background": return validateValue(layerId, key, value, "object", 4, 0, 255); break;

       case "line-label":         return validateValue(layerId, key, value, "boolean"); break;
       case "line-label-source":  return validateValue(layerId, key, value, "string"); break;
       case "line-label-color":   return validateValue(layerId, key, value, "object", 4, 0, 255); break;
       case "line-label-size":    return validateValue(layerId, key, value, "number", null, 0.0001, Number.MAXVALUE); break;
       case "line-label-offset":  return validateValue(layerId, key, value, "number", null, -Number.MAXVALUE, Number.MAXVALUE); break;

       case "point":        return validateValue(layerId, key, value, "boolean"); break;
       case "point-flat":   return validateValue(layerId, key, value, "boolean"); break;
       case "point-radius": return validateValue(layerId, key, value, "number", null, 0.0001, Number.MAXVALUE); break;
       case "point-Layer":  return validateValue(layerId, key, value, "string"); break;

       case "point-color":  return validateValue(layerId, key, value, "object", 4, 0, 255); break;

       case "icon":         return validateValue(layerId, key, value, "boolean"); break;
       case "icon-source":  return validateValue(layerId, key, value, "object", 5, -Number.MAXVALUE, Number.MAXVALUE); break;
       case "icon-scale":   return validateValue(layerId, key, value, "number", null, 0.0001, Number.MAXVALUE); break;
       case "icon-offset":  return validateValue(layerId, key, value, "object", 2, -Number.MAXVALUE, Number.MAXVALUE); break;
       case "icon-origin":  return validateValue(layerId, key, value, "string"); break;
       case "icon-stick":   return validateValue(layerId, key, value, "object", 7, -Number.MAXVALUE, Number.MAXVALUE); break;
       case "icon-color":   return validateValue(layerId, key, value, "object", 4, 0, 255); break;

       case "label":         return validateValue(layerId, key, value, "boolean"); break;
       case "label-color":   return validateValue(layerId, key, value, "object", 4, 0, 255); break;
       case "label-source":  return validateValue(layerId, key, value, "string"); break;
       case "label-size":    return validateValue(layerId, key, value, "number", null, 0.0001, Number.MAXVALUE); break;
       case "label-offset":  return validateValue(layerId, key, value, "object", 2, -Number.MAXVALUE, Number.MAXVALUE); break;
       case "label-origin":  return validateValue(layerId, key, value, "string"); break;
       case "label-align":   return validateValue(layerId, key, value, "string"); break;
       case "label-stick":   return validateValue(layerId, key, value, "object", 7, -Number.MAXVALUE, Number.MAXVALUE); break;
       case "label-width":   return validateValue(layerId, key, value, "number", null, 0.0001, Number.MAXVALUE); break;

       case "polygon":         return validateValue(styleId, key, value, "boolean"); break;
       case "polygon-color":   return validateValue(styleId, key, value, "object", 4, 0, 255); break;

       case "z-index":        return validateValue(layerId, key, value, "number", null, -Number.MAXVALUE, Number.MAXVALUE); break;
       case "zbuffer-offset": return validateValue(layerId, key, value, "object", 3, 0, Number.MAXVALUE); break;

       case "hover-event":  return validateValue(layerId, key, value, "boolean"); break;
       case "hover-layer":  return validateValue(layerId, key, value, "string"); break;
       case "enter-event":  return validateValue(layerId, key, value, "boolean"); break;
       case "leave-event":  return validateValue(layerId, key, value, "boolean"); break;
       case "click-event":  return validateValue(layerId, key, value, "boolean"); break;
       case "draw-event":   return validateValue(layerId, key, value, "boolean"); break;

       case "visible":     return validateValue(layerId, key, value, "boolean"); break;
       case "visibility":  return validateValue(layerId, key, value, "number", null, 0.0001, Number.MAXVALUE); break;
       case "culling":     return validateValue(layerId, key, value, "number", 180, 0.0001, 180); break;
       case "next-pass":   return validateValue(layerId, key, value, "object"); break;
    }

    return value; //custom property
};


var getDefaultLayerPropertyValue = function(key) {
    switch(key) {
       case "filter": return null;

       case "inherit": return "";

       case "line":       return false;
       case "line-flat":  return false;
       case "line-width": return 1;
       case "line-color": return [255,255,255,255];
       case "line-style": return "solid";
       case "line-style-texture":    return null;
       case "line-style-background": return [0,0,0,0];

       case "line-label":        return false;
       case "line-label-color":  return [255,255,255,255];
       case "line-label-source": return "$name";
       case "line-label-size":   return 1;
       case "line-label-offset": return 0;

       case "point":        return false;
       case "point-flat":   return false;
       case "point-radius": return 1;
       case "point-Layer":  return "solid";
       case "point-color":  return [255,255,255,255];

       case "icon":         return false;
       case "icon-source":  return null;
       case "icon-scale":   return 1;
       case "icon-offset":  return [0,0];
       case "icon-origin":  return "bottom-center";
       case "icon-stick":   return [0,0,0,255,255,255,255];
       case "icon-color":   return [255,255,255,255];

       case "label":         return false;
       case "label-color":   return [255,255,255,255];
       case "label-source":  return "$name";
       case "label-size":    return 10;
       case "label-offset":  return [0,0];
       case "label-origin":  return "bottom-center";
       case "label-align":   return "center";
       case "label-stick":   return [0,0,0,255,255,255,255];
       case "label-width":   return 200;
       
       case "polygon":        return false;
       case "polygon-color":  return [255,255,255,255];

       case "z-index":        return 0;
       case "zbuffer-offset": return [0,0,0];

       case "hover-event": return false;
       case "hover-layer": return "";
       case "enter-event": return false;
       case "leave-event": return false;
       case "click-event": return false;
       case "draw-event":  return false;

       case "visible":    return true;
       case "visibility": return 0;
       case "culling":    return 180;
       case "next-pass":  return null;
    }
};


function getFilterResult(filter, feature, featureType, group) {
    if (!filter || !Array.isArray(filter)) {
        return false;
    }

    switch(filter[0]) {
        case "all": 
            var result = true;
            for (var i = 1, li = filter.length; i < li; i++) {
                result = result && getFilterResult(filter[i], feature, featureType, group);
            }
           
            return result;                         

        case "any":
            var result = false;
            for (var i = 1, li = filter.length; i < li; i++) {
                result = result || getFilterResult(filter[i], feature, featureType, group);
            }
           
            return result;                         

        case "none":
            var result = true;
            for (var i = 1, li = filter.length; i < li; i++) {
                result = result && getFilterResult(filter[i], feature, featureType, group);
            }
           
            return (!result);                         
                              
        case "skip": return false; 
    }

    var value;

    switch(filter[1]) {
        case "#type":  value = featureType; break;   
        case "#group": value = group;       break;
        default:   
            var filterValue = filter[1];  

            if (filterValue && filterValue.length > 0) {
                //is it feature property?
                switch (filterValue.charAt(0)) {
                    case "$": value = feature.properties[filterValue.substr(1)]; break;
                    case "@": value = globals.stylesheetConstants[filterValue]; break;
                    default:
                        value = feature.properties[filterValue]; //fallback for old format
                }
            }
    }

    switch(filter[0]) {
        case "==": return (value == filter[2]);
        case "!=": return (value != filter[2]);
        case ">=": return (value >= filter[2]);
        case "<=": return (value <= filter[2]);
        case ">": return (value > filter[2]);
        case "<": return (value < filter[2]);
        
        case "has": return (typeof value != "undefined");
        case "!has": return (typeof value == "undefined");
        
        case "in":
            for (var i = 2, li = filter.length; i < li; i++) {
                if (filter[i] == value) {
                    return true;
                }
            } 
            return false;
        
        case "!in":
            for (var i = 2, li = filter.length; i < li; i++) {
                if (filter[i] == value) {
                    return false;
                }
            } 
            return true;
    }            

    return false;    
};


var processLayer = function(layerId, layerData, stylesheetLayersData) {
    var layer = {};

    //copy Layer and inherit Layer if needed
    copyLayer(layerId, layer, layerData, stylesheetLayersData);

    //console.log(JSON.stringify(layer));

    //replace constants and validate properties
    for (var key in layer) {

        var value = layer[key];

        //replace constant with value
        if ((typeof value) == "string") {
            if (value.length > 0) {
                //is it constant?
                if (value.charAt(0) == "@") {
                    if (globals.stylesheetConstants[value] != null) {
                        //replace constant with value
                        layer[key] = globals.stylesheetConstants[value];
                    } else {
                        logError("wrong-object", layerId, key, value, null, "constant");

                        //replace constant with deafault value
                        layer[key] = getDefaultLayerPropertyValue(key);
                    }
                }
            }
        }

        //console.log("process."+layerId+"."+key+"."+value);
        //console.log("out1: "+JSON.stringify(layer[key]));

        layer[key] = validateLayerPropertyValue(layerId, key, layer[key]);

        //console.log("out2: "+JSON.stringify(layer[key]));
    }

    return layer;
};


var processStylesheet = function(stylesheetLayersData) {
    globals.stylesheetBitmaps = {};
    globals.stylesheetConstants = stylesheetLayersData["constants"] || {};

    //get bitmaps
    var bitmaps = stylesheetLayersData["bitmaps"] || {};

    //build map
    for (var key in bitmaps) {
        var bitmap = bitmaps[key];
        var skip = false;

        if ((typeof bitmap) == "string") {
            bitmap = {"url":bitmap};
        } else if((typeof bitmap) == "object"){
            if (bitmap["url"] == null) {
                logError("wrong-bitmap", key);
            }
        } else {
            logError("wrong-bitmap", key);
        }

        if (skip != true) {
            globals.stylesheetBitmaps[key] = bitmap;
        }
    }

    //load bitmaps
    postMessage({"command":"loadBitmaps", "bitmaps": globals.stylesheetBitmaps});

    //get layers
    globals.stylesheetData = {
        layers : {}
    };

    var layers = stylesheetLayersData["layers"] || {};

    //console.log(JSON.stringify(Layers));

    globals.stylesheetLayers = globals.stylesheetData.layers;

    //process layers
    for (var key in layers) {
        globals.stylesheetData.layers[key] = processLayer(key, layers[key], stylesheetLayersData);

        //console.log(JSON.stringify(stylesheetData.layers[key]));
    }
};


export {getFilterResult, processStylesheet, getLayer, getLayerPropertyValue, getLayerExpresionValue};
