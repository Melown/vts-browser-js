
import {math as math_} from './math';
import {utilsUrl as utilsUrl_} from './url';

//get rid of compiler mess
var math = math_;
var utilsUrl = utilsUrl_;


var utils = {}
utils.useCredentials = false;
utils.instanceCounter = 0;


utils.validateBool = function(value, defaultValue) {
    if (typeof value === "boolean") {
        return value;
    } else {
        return defaultValue;
    }
};


utils.validateNumber = function(value, minValue, maxValue, defaultValue) {
    if (typeof value === "number") {
        return math.clamp(value, minValue, maxValue);
    } else {
        return defaultValue;
    }
};


utils.validateNumberArray = function(array, arraySize, minValues, maxValues, defaultValues) {
    if (Array.isArray(array) && array.length == arraySize) {
        for (var i = 0; i < arraySize; i++) {
            array[i] = math.clamp(array[i], minValues[i], maxValues[i]);
        }
        return array;
    } else {
        return defaultValues;
    }
};


utils.validateString = function(value, defaultValue) {
    if (typeof value === "string") {
        return value;
    } else {
        return defaultValue;
    }
};


utils.padNumber = function(n, width) {
  var z = '0';

  if (n < 0) {
      n = (-n) + '';
      width--;     //7
      return n.length >= width ? ("-" + n) : "-" + (new Array(width - n.length + 1).join(z) + n);
  } else {
      n = n + '';
      return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
  }
};


utils.decodeFloat16 = function(binary) {
    var exponent = (binary & 0x7C00) >> 10;
    var fraction = binary & 0x03FF;
    return (binary >> 15 ? -1 : 1) * (
        exponent ?
        (
            exponent === 0x1F ?
            fraction ? NaN : Infinity :
            Math.pow(2, exponent - 15) * (1 + fraction / 0x400)
        ) :
        6.103515625e-5 * (fraction / 0x400)
    );
};


utils.simpleFmtObj = (function obj(str, obj) {
    if (!str || str == "") {
        return "";
    }

    return str.replace(/\{([$a-zA-Z0-9][$a-zA-Z0-9]*)\}/g, function(s, match) {
        return (match in obj ? obj[match] : s);
    });
});


utils.simpleWikiLinks = (function obj(str, plain) {
    if (!str || str == "") {
        return "";
    }

    var str2 = utils.simpleFmtObj(str, {"copy":"&copy;", "Y": (new Date().getFullYear())}); 
    
    return str2.replace(/\[([^\]]*)\]/g, function(s, match) {
        match  = match.trim();
        var urls = match.split(" ");//, 1);
        
        if (urls[0].indexOf("//") != -1) {
            if (plain) {
                if (urls.length > 1) {
                    return "" + match.substring(urls[0].length);
                } else {
                    return "" + urls[0];
                }
            } else {
                if (urls.length > 1) {
                    return "<a href=" + urls[0] + " target='blank'>" + match.substring(urls[0].length)+"</a>";
                } else {
                    return "<a href=" + urls[0] + " target='blank'>" + urls[0]+"</a>";
                }
            }
        }
        
        return match;
    });
});


utils.simpleFmtObjOrCall = (function obj(str, obj, call) {
    if (!str || str == "") {
        return "";
    }

    return str.replace(/\{([$a-zA-Z(-9][$a-zA-Z(-9]*)\}/g, function(s, match) {
        return (match in obj ? obj[match] : call(match));
    });
});


utils.getABGRFromHexaCode = (function(code) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(code);

    return result ?
        [ parseInt(result[4], 16),
          parseInt(result[3], 16),
          parseInt(result[2], 16),
          parseInt(result[1], 16)]
    : [0,0,0,255];
});


utils.stringifyFunction = (function(fn) {
    // Stringify the code
    return '(' + fn + ').call(self);';
});


utils.loadJSON = function(path, onLoaded, onError, skipParse, withCredentials, xhrParams) {
    var xhr = new XMLHttpRequest();

    //xhr.onload  = (function() {
    xhr.onreadystatechange = (function (){

        switch (xhr.readyState) {
            case 0 : // UNINITIALIZED
            case 1 : // LOADING
            case 2 : // LOADED
            case 3 : // INTERACTIVE
                break;
            case 4 : // COMPLETED
    
                if (xhr.status >= 400 || xhr.status == 0) {
                    if (onError) {
                        onError(xhr.status);
                    }
                    break;
                }
    
                var data = xhr.response;
                var parsedData = data;
                
                if (!skipParse) {
                    try {
                        //var parsedData = skipParse ? data : eval("("+data+")");
                        parsedData = JSON.parse(data);
                    } catch(e) {
                        console.log("JSON Parse Error ("+path+"): " + (e["message"] ? e["message"] : ""));
                        
                        if (onError ) {
                            onError(xhr.status);
                        }
                
                        return;
                    }
                }
                
                if (onLoaded) {
                    onLoaded(parsedData);
                }
    
                break;
        }

    }).bind(this);

    /*
    xhr.onerror  = (function() {
        if (onError) {
            onError();
        }
    }).bind(this);*/

    xhr.open('GET',  path, true);
    xhr.withCredentials = withCredentials;
    
    if (xhrParams && xhrParams["token"] /*&& xhrParams["tokenHeader"]*/) {
        //xhr.setRequestHeader(xhrParams["tokenHeader"], xhrParams["token"]); //old way
        xhr.setRequestHeader("Accept", "token/" + xhrParams["token"] + ", */*");
    }
    
    xhr.send("");
};


utils.loadBinary = function(path, onLoaded, onError, withCredentials, xhrParams, responseType) {
    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = (function (){

        switch (xhr.readyState) {
            case 0 : // UNINITIALIZED
            case 1 : // LOADING
            case 2 : // LOADED
            case 3 : // INTERACTIVE
            break;
            case 4 : // COMPLETED
    
                    if (xhr.status >= 400 || xhr.status == 0) {
                        if (onError) {
                            onError(xhr.status);
                        }
                        break;
                    }
    
                    var abuffer = xhr.response;
                    
                    if (!abuffer) {
                        if (onError) {
                            onError();
                        }
                        break;
                    }
                    
                    //if (!responseType || responseType == "arraybuffer") {
                        //var data = new DataView(abuffer);
                    //} else {
                      //  var data = abuffer;
                    //}
    
                    if (onLoaded) {
                        onLoaded(abuffer);
                    }
    
              break;
    
              default:
    
                if (onError) {
                    onError();
                }
    
                break;
          }

       }).bind(this);
    
    /*
    xhr.onerror  = (function() {
        if (onError) {
            onError();
        }
    }).bind(this);*/

    xhr.open('GET', path, true);
    xhr.responseType = responseType ? responseType : "arraybuffer";
    xhr.withCredentials = withCredentials;

    if (xhrParams && xhrParams["token"] /*&& xhrParams["tokenHeader"]*/) {
        //xhr.setRequestHeader(xhrParams["tokenHeader"], xhrParams["token"]); //old way
        xhr.setRequestHeader("Accept", "token/" + xhrParams["token"] + ", */*");
    }

    xhr.send("");
};


utils.headRequest = function(url, onLoaded, onError, withCredentials, xhrParams, responseType) { 
    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = (function (){

            switch (xhr.readyState) {
            case 0 : // UNINITIALIZED
            case 1 : // LOADING
            case 2 : // LOADED
            case 3 : // INTERACTIVE
                break;
            case 4 : // COMPLETED
                if (onLoaded != null) {
                    onLoaded(xhr.getAllResponseHeaders(), xhr.status);
                    //onLoaded(xhr.getResponseHeader("X-VE-Tile-Info"), xhr.status);
                }
                break;
    
            default:
    
                if (onError != null) {
                    onError();
                }
    
                break;
            }

        }).bind(this);

    xhr.onerror  = (function() {
        if (onError != null) {
            onError();
        }
    }).bind(this);

    xhr.open('HEAD', url, true);
    //xhr.responseType = responseType ? responseType : "arraybuffer";
    xhr.withCredentials = withCredentials;

    if (xhrParams && xhrParams["token"] /*&& xhrParams["tokenHeader"]*/) {
        //xhr.setRequestHeader(xhrParams["tokenHeader"], xhrParams["token"]); //old way
        xhr.setRequestHeader("Accept", "token/" + xhrParams["token"] + ", */*");
    }

    xhr.send("");
};


utils.loadImage = function(url, onload, onerror, withCredentials, direct) {
    var image = new Image();
    image.onerror = onerror;
    image.onload = onload;

    if (!direct){
        image.crossOrigin = withCredentials ? "use-credentials" : "anonymous";
    }

    image.src = url;
    return image;
};


utils.getParamsFromUrl = function(url) {
    return utilsUrl.getParamsFromUrl(url);
};


export {utils};

// only implement if no native implementation is available
/*
if (typeof Array.isArray === 'undefined') {
  Array.isArray = (function(obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
  });
}*/

/*
Mel["isEqual"] = utils.isEqual;
Mel["clamp"] = utils.clamp;
Mel["mix"] = utils.mix;
Mel["radians"] = utils.radians;
Mel["degrees"] = utils.degrees;
Mel["loadJSON"] = utils.loadJSON;
Mel["loadBinary"] = utils.loadBinary;
*/
