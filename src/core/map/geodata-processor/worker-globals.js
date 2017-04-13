
var globals = {
    stylesheetData : {},
    stylesheetLayers : {},
    stylesheetBitmaps : {},
    stylesheetConstants : {},
    forceOrigin : false,
    forceScale : [1,1,1],
    bboxMin : [0,0,0],
    bboxMax : [1,1,1],
    geocent : false,
    tileX : 0,
    tileY : 0,
    tileLod : 0,
    fonts : {},
    hitState : 0,
    groupOptimize : true,
    groupOrigin : [0,0,0],
    messageBuffer : new Array(65536),
    messageBuffer2 : new Array(65536),
    messageBufferIndex : 0,
    messageBufferSize : 65536,
    autoLod : false
};


function clamp(value, min, max) {
    if (value < min) {
        value = min;
    }

    if (value > max) {
        value = max;
    }

    return value;
};


function vec3Normalize(a, b) {
    b || (b = a);
    var c = a[0],
        d = a[1],
        e = a[2],
        g = Math.sqrt(c * c + d * d + e * e);
    if (g) {
        if (g == 1) {
            b[0] = c;
            b[1] = d;
            b[2] = e;
            return b;
        }
    } else {
        b[0] = 0;
        b[1] = 0;
        b[2] = 0;
        return b;
    }
    g = 1 / g;
    b[0] = c * g;
    b[1] = d * g;
    b[2] = e * g;
    return b;
};


function vec3Length(a) {
    var b = a[0],
        c = a[1];
    a = a[2];
    return Math.sqrt(b * b + c * c + a * a);
};


function vec3Cross(a, b, c) {
    c || (c = a);
    var d = a[0],
        e = a[1];
    a = a[2];
    var g = b[0],
        f = b[1];
    b = b[2];
    c[0] = e * b - a * f;
    c[1] = a * g - d * b;
    c[2] = d * f - e * g;
    return c;
};


function vec3AnyPerpendicular(a, b) {
    b || (b = a);
    var c = a[0],
        d = a[1],
        e = a[2];
        
    b[0] = 1;        
    b[1] = 1;        

    var f = c + d;

    if (e) {
        b[2] = -f / e;        
    } else {
        b[2] = 0;
    }

    return b;
};


export {globals, clamp, vec3Normalize, vec3Length, vec3Cross, vec3AnyPerpendicular};