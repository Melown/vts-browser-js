
import {vec3 as vec3_, mat4 as mat4_} from '../../utils/matrix';
import BBox_ from '../bbox';
import {math as math_} from '../../utils/math';
import {utils as utils_} from '../../utils/utils';
import {utilsUrl as utilsUrl_} from '../../utils/url';
import MapResourceNode_ from '../../map/resource-node';
import MapGeodataImport3DTiles_ from '../../map/geodata-import/3dtiles';
import MapGeodataImport3DTiles2_ from '../../map/geodata-import/3dtiles2';
import MapGeodataBuilder_ from '../../map/geodata-builder';

//get rid of compiler mess
var vec3 = vec3_, mat4 = mat4_;
var BBox = BBox_;
var math = math_;
var utils = utils_;
var MapResourceNode = MapResourceNode_;
var MapGeodataImport3DTiles = MapGeodataImport3DTiles_;
var MapGeodataImport3DTiles2 = MapGeodataImport3DTiles2_;
var MapGeodataBuilder = MapGeodataBuilder_;
var utilsUrl = utilsUrl_;

var localTest = true;

var GpuGroup = function(id, bbox, origin, gpu, renderer) {
    this.id = id;
    this.bbox = null;
    this.origin = origin || [0,0,0];
    this.gpu = gpu;
    this.gl = gpu.gl;
    this.renderer = renderer;
    this.jobs = [];
    this.reduced = 0;
    this.geometries = {};
    this.subjob = null;
    this.mv = new Float32Array(16);
    this.mvp = new Float32Array(16);
    this.loadMode = 0;
    //this.geFactor = 1/38;
    this.geFactor = 1/16;
    this.geFactor2 = 0.5;
    this.geNormalized = false;
    
    if (bbox != null && bbox[0] != null && bbox[1] != null) {
        this.bbox = new BBox(bbox[0][0], bbox[0][1], bbox[0][2], bbox[1][0], bbox[1][1], bbox[1][2]);
    }

    this.binFiles = [];

    this.size = 0;
    this.polygons = 0;
};

//destructor
GpuGroup.prototype.kill = function() {
    for (var i = 0, li = this.jobs.length; i < li; i++) {
        var job = this.jobs[i]; 

        switch(job.type) {
        case VTS_JOB_FLAT_LINE:
        case VTS_JOB_POLYGON:
            if (job.vertexPositionBuffer) this.gl.deleteBuffer(job.vertexPositionBuffer);
            if (job.vertexElementBuffer) this.gl.deleteBuffer(job.vertexElementBuffer);
            break;

        case VTS_JOB_FLAT_TLINE:
        case VTS_JOB_FLAT_RLINE:
        case VTS_JOB_PIXEL_LINE:
        case VTS_JOB_PIXEL_TLINE:
            if (job.vertexPositionBuffer) this.gl.deleteBuffer(job.vertexPositionBuffer);
            if (job.vertexNormalBuffer) this.gl.deleteBuffer(job.vertexNormalBuffer);
            if (job.vertexElementBuffer) this.gl.deleteBuffer(job.vertexElementBuffer);
            break;

        case VTS_JOB_LINE_LABEL:
            if (job.vertexPositionBuffer) this.gl.deleteBuffer(job.vertexPositionBuffer);
            if (job.vertexTexcoordBuffer) this.gl.deleteBuffer(job.vertexTexcoordBuffer);
            if (job.vertexElementBuffer) this.gl.deleteBuffer(job.vertexElementBuffer);
            break;

        case VTS_JOB_ICON:
        case VTS_JOB_LABEL:
            if (job.vertexPositionBuffer) this.gl.deleteBuffer(job.vertexPositionBuffer);
            if (job.vertexTexcoordBuffer) this.gl.deleteBuffer(job.vertexTexcoordBuffer);
            if (job.vertexOriginBuffer) this.gl.deleteBuffer(job.vertexOriginBuffer);
            if (job.vertexElementBuffer) this.gl.deleteBuffer(job.vertexElementBuffer);
            break;
        }
    }

    //remove geometries
    for (var key in this.geometries) {
        var geometries = this.geometries[key];
        var globalGeometry = this.renderer.geometries[key];
        this.geometries[key] = null;

        //remove geometry from glbal stack
        for (i = 0, li = geometries.length; i < li; i++) {
            if (geometries[i] == globalGeometry) {
                this.renderer.geometries[key] = null;
            }
        }
    }
};


GpuGroup.prototype.getSize = function() {
    return this.size;
};


GpuGroup.prototype.getZbufferOffset = function() {
    return this.size;
};

GpuGroup.prototype.addGeometry = function(data) {
    var id = data['id'];

    if (!this.geometries[id]) {
        this.geometries[id] = [data];
    } else {
        this.geometries[id].push(data);
    }

    this.renderer.geometries[id] = data;
};

GpuGroup.prototype.convertColor = function(c) {
    var f = 1.0/255;
    return [c[0]*f, c[1]*f, c[2]*f, c[3]*f];
};

GpuGroup.prototype.addLineJob = function(data) {
    var gl = this.gl;

    var vertices = data.vertexBuffer;

    var job = {};

    if (data.type == VTS_WORKER_TYPE_POLYGON) {
        job.type = VTS_JOB_POLYGON;
    } else {
        job.type = VTS_JOB_FLAT_LINE;
    }

    job.program = this.renderer.progLine;
    job.color = this.convertColor(data['color']);
    job.zIndex = data['z-index'] + 256;
    job.clickEvent = data['click-event'];
    job.hoverEvent = data['hover-event'];
    job.enterEvent = data['enter-event'];
    job.leaveEvent = data['leave-event'];
    job.advancedHit = data['advancedHit'];
    job.hitable = data['hitable'];
    job.eventInfo = data['eventInfo'];
    job.style = data['style'] || 0;
    job.stencil = (data['stencil'] === false) ? false : true;
    job.culling = data['culling'] || 0;
    job.state = data['state'];
    job.center = data['center'];
    job.lod = data['lod'];
    job.lineWidth = data['line-width'];
    job.zbufferOffset = data['zbuffer-offset'];
    job.reduced = false;
    job.ready = true;
    job.bbox = this.bbox;

    if (!job.program.isReady()) {
        return;
    }

    if (job.advancedHit) {
        job.program2 = this.renderer.progELine;

        if (!job.program2.isReady()) {
            return;
        }
    }

    //create vertex buffer
    job.vertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    job.vertexPositionBuffer.itemSize = 3;
    job.vertexPositionBuffer.numItems = vertices.length / 3;

    if (job.advancedHit) {
        job.program = this.renderer.progLine;

        var elements = data.elementBuffer;

        job.vertexElementBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexElementBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, elements, gl.STATIC_DRAW);
        job.vertexElementBuffer.itemSize = 1;
        job.vertexElementBuffer.numItems = elements.length;
    }

    this.jobs.push(job);

    this.size += vertices.length * 4;
    this.polygons += vertices.length / (3 * 3);
};


GpuGroup.prototype.addExtentedLineJob = function(data) {
    var gl = this.gl;

    var vertices = data.vertexBuffer;
    var normals = data.normalBuffer;

    var job = {};
    job.type = data['type'];

    
    switch(job.type) {
    case VTS_WORKER_TYPE_FLAT_LINE:  job.type = VTS_JOB_FLAT_TLINE;  break;
    case VTS_WORKER_TYPE_FLAT_RLINE:  job.type = VTS_JOB_FLAT_RLINE;  break;
    case VTS_WORKER_TYPE_PIXEL_LINE:  job.type = VTS_JOB_PIXEL_LINE;  break;
    case VTS_WORKER_TYPE_PIXEL_TLINE: job.type = VTS_JOB_PIXEL_TLINE; break;
    }

    job.color = this.convertColor(data['color']);
    job.zIndex = data['z-index'] + 256;
    job.clickEvent = data['click-event'];
    job.hoverEvent = data['hover-event'];
    job.hitable = data['hitable'];
    job.eventInfo = data['eventInfo'];
    job.enterEvent = data['enter-event'];
    job.leaveEvent = data['leave-event'];
    job.advancedHit = data['advancedHit'];
    job.widthByRatio = data['width-units'] == 'ratio',
    job.state = data['state'];
    job.center = data['center'];
    job.lod = data['lod'];
    job.lineWidth = data['line-width'];
    job.zbufferOffset = data['zbuffer-offset'];
    job.reduced = false;
    job.ready = true;
    job.bbox = this.bbox;

    if (data['texture'] != null) {
        var texture = data['texture'];
        var bitmap = texture[0];
        job.texture = [this.renderer.getBitmap(bitmap['url'], bitmap['filter'] || 'linear', bitmap['tiled'] || false),
            texture[1], texture[2], texture[3], texture[4]];
        var background = this.convertColor(data['background']);

        if (background[3] != 0) {
            job.background = background;
        }
    }

    switch(job.type) {
    case VTS_JOB_FLAT_TLINE:   job.program = (background[3] != 0) ? this.renderer.progTBLine : this.renderer.progTLine;  break;
    case VTS_JOB_FLAT_RLINE:   job.program = this.renderer.progRLine;  break;
    case VTS_JOB_PIXEL_LINE:   job.program = this.renderer.progLine3;  break;
    case VTS_JOB_PIXEL_TLINE:  job.program = (background[3] != 0) ? this.renderer.progTPBLine : this.renderer.progTPLine; break;
    }

    if (!job.program.isReady()) {
        return;
    }

    if (job.advancedHit) {
        switch(job.type) {
        case VTS_JOB_FLAT_TLINE:   job.program2 = this.renderer.progETLine;  break;
        case VTS_JOB_FLAT_RLINE:   job.program2 = this.renderer.progERLine;  break;
        case VTS_JOB_PIXEL_LINE:   job.program2 = this.renderer.progELine3;  break;
        case VTS_JOB_PIXEL_TLINE:  job.program2 = this.renderer.progETPLine; break;
        }

        if (!job.program2.isReady()) {
            return;
        }
    }

    //create vertex buffer
    job.vertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    job.vertexPositionBuffer.itemSize = 4;
    job.vertexPositionBuffer.numItems = vertices.length / 4;

    //create normal buffer
    job.vertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
    job.vertexNormalBuffer.itemSize = 4;
    job.vertexNormalBuffer.numItems = normals.length / 4;

    if (job.advancedHit) {
        var elements = data.elementBuffer;

        job.vertexElementBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexElementBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, elements, gl.STATIC_DRAW);
        job.vertexElementBuffer.itemSize = 1;
        job.vertexElementBuffer.numItems = elements.length;
    }

    this.jobs.push(job);

    this.size += vertices.length * 4 + normals.length * 4;
    this.polygons += vertices.length / (4 * 3);
};


GpuGroup.prototype.processReduce = function(job) {
    if (job.reduce) {
        switch(job.reduce[0]) {
            case 'tilt':       job.reduce[0] = 1; break;
            case 'tilt-cos':   job.reduce[0] = 2; break;
            case 'tilt-cos2':  job.reduce[0] = 3; break;
            case 'scr-count':  job.reduce[0] = 4; break;
            case 'scr-count2': job.reduce[0] = 5; this.renderer.drawnGeodataTilesUsed = true; break;
            case 'scr-count3': job.reduce[0] = 6; this.renderer.drawnGeodataTilesUsed = true; break;
            case 'scr-count4': job.reduce[0] = 7; break;
            case 'scr-count5': job.reduce[0] = 8; break;
            case 'scr-count6': job.reduce[0] = 9; break;
            case 'scr-count7': job.reduce[0] = 10; break;
            case 'scr-count8': job.reduce[0] = 11; break;
        }

        job.reduce[5] = 0; //zero debug value
        job.reduce[6] = 0;
        job.reduce[7] = 0;

        if (job.reduce[0] >= 7 && job.reduce[0] <= 11) {

            if (job.reduce[0] == 10 || job.reduce[0] == 11) {
                job.reduce[1] = Math.abs(job.reduce[1]);
                job.reduce[3] = job.reduce[1] * job.reduce[2];
                job.reduce[2] = job.reduce[1];
                job.reduce[4] = 0;
            } else {
                job.reduce[2] = Math.abs(job.reduce[1]); //copy prominence for prom / dist support

                if (this.renderer.config.mapFeaturesReduceFactor >= 1) { // prom / dists
                    job.reduce[1] = job.reduce[2];
                } else {
                    if (job.reduce[0] == 9) {
                        job.reduce[1] = job.reduce[2];
                    } else {
                        job.reduce[1] = Math.floor((Math.log(job.reduce[2] * 500) / Math.log(1.0017)) + 5000);
                    }
                }
            }
        }
    }
};


GpuGroup.prototype.addLineLabelJob = function(data) {
    var gl = this.gl;

    if (data.singleBuffer) {
        var singleBuffer = data.singleBuffer;
        var singleBuffer2 = data.singleBuffer2;
    } else {
        var vertices = data.vertexBuffer;
        var texcoords = data.texcoordsBuffer;
    }

    var job = {};
    job.type = VTS_JOB_LINE_LABEL;
    job.program = this.renderer.progText;
    job.color = this.convertColor(data['color']);
    job.color2 = this.convertColor(data['color2']);
    job.outline = data['outline'];
    job.zIndex = data['z-index'] + 256;
    job.visibility = data['visibility'];
    job.culling = data['culling'];
    job.clickEvent = data['click-event'];
    job.hoverEvent = data['hover-event'];
    job.enterEvent = data['enter-event'];
    job.leaveEvent = data['leave-event'];
    job.hitable = data['hitable'];
    job.eventInfo = data['eventInfo'];
    job.state = data['state'];
    job.center = data['center'];
    job.lod = data['lod'];
    job.labelPoints = data['labelPoints'];
    job.labelIndex = data['labelIndex'];
    job.labelSize = data['labelSize'];
    job.zbufferOffset = data['zbuffer-offset'];
    job.hysteresis = data['hysteresis'];
    job.noOverlap = data['noOverlap'];
    job.labelPointsBuffer = { id: -1, points: [], points2: [] },
    job.id = job.hysteresis ? job.hysteresis[2] : null;
    job.reduced = false;
    job.ready = true;
    job.bbox = this.bbox;
    job.reduce = data['reduce'];

    this.processReduce(job);
    
    job.files = data['files'] || [];
    var fonts = data['fonts'] || ['#default'];
    job.fonts = fonts;

    for (var i = 0, li = fonts.length; i < li; i++) {
        fonts[i] = this.renderer.fonts[fonts[i]];
    }

    job.program = this.renderer.progText2;

    if (!job.program.isReady()) {
        return;
    }

    if (singleBuffer) {

        job.singleBuffer = singleBuffer;
        job.singleBuffer2 = singleBuffer2;
        job.textVector = data['textVector'];

        //this.size += vertices.length * 4 + texcoords.length * 4;
        this.polygons += (singleBuffer.length / 12) * 2;

    } else {
        //create vertex buffer
        job.vertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        job.vertexPositionBuffer.itemSize = 4;
        job.vertexPositionBuffer.numItems = vertices.length / 4;

        //create normal buffer
        job.vertexTexcoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexTexcoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);
        job.vertexTexcoordBuffer.itemSize = 4;
        job.vertexTexcoordBuffer.numItems = texcoords.length / 4;

        this.size += vertices.length * 4 + texcoords.length * 4;
        this.polygons += vertices.length / (4 * 3);
    }

    this.jobs.push(job);
};


GpuGroup.prototype.addIconJob = function(data, label, tile) {
    var gl = this.gl;

    var vertices = data.vertexBuffer;
    var texcoords = data.texcoordsBuffer;
    var origins = data.originBuffer;
    var singleBuffer = data.singleBuffer;
    var s = data['stick'];
    var f = 1.0/255;

    var job = { tile: tile };
    job.type = label ? VTS_JOB_LABEL : VTS_JOB_ICON;
    job.program = this.renderer.progIcon;
    job.color = this.convertColor(data['color']);
    job.zIndex = data['z-index'] + 256;
    job.visibility = data['visibility'];
    job.culling = data['culling'];
    job.clickEvent = data['click-event'];
    job.hoverEvent = data['hover-event'];
    job.enterEvent = data['enter-event'];
    job.leaveEvent = data['leave-event'];
    job.hitable = data['hitable'];
    job.eventInfo = data['eventInfo'];
    job.state = data['state'];
    job.center = data['center'];
    job.stick = [s[0], s[1], s[2], s[3]*f, s[4]*f, s[5]*f, s[6]*f, s[7]];
    job.lod = data['lod'];
    job.zbufferOffset = data['zbuffer-offset'];
    job.hysteresis = data['hysteresis'];
    job.noOverlap = data['noOverlap'];
    job.id = job.hysteresis ? job.hysteresis[2] : null;
    job.reduced = false;
    job.ready = true;
    job.reduce = data['reduce'];

    this.processReduce(job);

    if (!job.program.isReady()) {
        return;
    }

    if (label !== true) {
        var icon = data['icon'];
        job.texture = this.renderer.getBitmap(null, icon['filter'] || 'linear', icon['tiled'] || false, icon['hash'], true);
        job.files = [];
    } else {
        job.color2 = this.convertColor(data['color2']);
        job.outline = data['outline'];
        job.size = data['size'];
        job.origin = data['origin'];
        job.files = data['files'] || [];
        job.index = data['index'] || 0;
        var fonts = data['fonts'] || ['#default'];
        job.fonts = fonts;
        job.gamma = [job.outline[2] * 1.4142 / job.size, job.outline[3] * 1.4142 / job.size];

        if (job.origin) {
            job.origin = new Float32Array(job.origin);
        }

        for (var i = 0, li = fonts.length; i < li; i++) {
            fonts[i] = this.renderer.fonts[fonts[i]];
        }

        job.program = this.renderer.progIcon2;
    }

    if (job.visibility != null && !Array.isArray(job.visibility)) {
        job.visibility = [job.visibility];
    }

    if (singleBuffer) {
        job.singleBuffer = singleBuffer;
        this.polygons += 2;

    } else {
        //create vertex buffer
        job.vertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        job.vertexPositionBuffer.itemSize = 4;
        job.vertexPositionBuffer.numItems = vertices.length / 4;

        //create normal buffer
        job.vertexTexcoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexTexcoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);
        job.vertexTexcoordBuffer.itemSize = 4;
        job.vertexTexcoordBuffer.numItems = texcoords.length / 4;

        //create origin buffer
        job.vertexOriginBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexOriginBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, origins, gl.STATIC_DRAW);
        job.vertexOriginBuffer.itemSize = 3;
        job.vertexOriginBuffer.numItems = origins.length / 3;

        this.size += job.vertexPositionBuffer.numItems * 4 +
                      job.vertexOriginBuffer.numItems * 4 +
                      job.vertexTexcoordBuffer.numItems * 4;
        this.polygons += job.vertexPositionBuffer.numItems / (4 * 3);
    }


    if (this.subjobs) {
        this.subjobs.push(job);
    } else {
        if (this.vsjobs) {
            this.vsjobs.push(job);
        } else {
            this.jobs.push(job);
        }
    }

};


GpuGroup.prototype.addPack = function(data) {
    if (!this.subjobs.length) {
        this.subjobs = null;
        return;
    }

    var job = {
        type : VTS_JOB_PACK,
        subjobs: this.subjobs,
        culling : 180,
        zIndex : 0,
        ready : true
    };

    //extract no overlap, remove it form subjobs
    for (var i = 0, li = job.subjobs.length; i < li; i++) {
        var subjob = job.subjobs[i];

        if (subjob.noOverlap) {
            
            if (!job.noOverlap) {
                job.noOverlap = subjob.noOverlap;
            } else {
                var o = job.noOverlap;
                var o2 = subjob.noOverlap;

                if (o2[0] < o[0]) o[0] = o2[0];
                if (o2[1] < o[1]) o[1] = o2[1];
                if (o2[2] > o[2]) o[2] = o2[2];
                if (o2[3] > o[3]) o[3] = o2[3];
            }

            subjob.noOverlap = null;
        }

        if (subjob.culling <= job.culling) {
            job.culling = subjob.culling;
            subjob.culling = 180;
        }

        if (subjob.visibility) {
            job.visibility = subjob.visibility;
            subjob.visibility = null;
        }

        if (subjob.stick) {
            job.stick = subjob.stick;
            subjob.stick = [0,0,0,255,255,255,255,0];
        }

        if (subjob.zIndex > job.zIndex) {
            job.zIndex = subjob.zIndex;
        }

        if (subjob.center) {
            job.center = subjob.center;
        }

        job.eventInfo = subjob.eventInfo;
        job.reduce = subjob.reduce;

        job.hysteresis = subjob.hysteresis;
        job.id = subjob.id;
    }

    if (this.vsjobs) {
        this.vsjobs.push(job);
    } else {
        this.jobs.push(job);
    }
    
    this.subjobs = null;
};


GpuGroup.prototype.addVSPoint = function(data, tile){
    var job = { tile: tile };
    job.type = VTS_JOB_VSPOINT;
    job.zIndex = data['z-index'] + 256;
    job.visibility = data['visibility'];
    job.culling = data['culling'];
    job.hitable = false;
    job.eventInfo = data['eventInfo'];
    job.state = data['state'];
    job.center = data['center'];
    job.lod = data['lod'];
    job.hysteresis = data['hysteresis'];
    job.id = job.hysteresis ? job.hysteresis[2] : null;
    job.reduced = false;
    job.ready = true;
    job.reduce = data['reduce'];
    job.vswitch = [];

    this.vsjob = job;
};


GpuGroup.prototype.storeVSJobs = function(data){
    this.vsjob.vswitch.push([data.viewExtent, this.vsjobs]);
    this.vsjobs = [];
};


GpuGroup.prototype.addVSwitch = function(){
    if (this.vsjob) {
        this.jobs.push(this.vsjob);
    }

    this.vsjobs = null;
};

GpuGroup.prototype.addMeshJob = function(data, lod) {
    var job = {};

    job.type = VTS_JOB_MESH;
    job.path = data['path'];
    
    job.textures = [];

    job.resources = new MapResourceNode(this.renderer.core.map, null, null);

    if (job.path) {
        var stmp = job.path.split(".");
        if (stmp.length > 1) {
            stmp.pop();
            job.texturePath = stmp.join('.');
        }

        job.mesh = job.resources.getMesh(job.path, null);
    }

    this.jobs.push(job);
};


GpuGroup.prototype.copyBuffer = function(buffer, source, index) {
    var tmp = new Uint8Array(buffer.buffer);
    tmp.set(new Uint8Array(source.buffer, index, buffer.byteLength));
    return buffer;
};


GpuGroup.prototype.addRenderJob2 = function(buffer, index, tile, direct) {
    var data, str, length, tmp, type;

    if (direct) {
        type = direct.type;
        data = direct.data;
    } else {
        var view = new DataView(buffer.buffer);
        type = buffer[index]; index += 1;

        if (type != VTS_WORKER_TYPE_PACK_BEGIN && type != VTS_WORKER_TYPE_PACK_END && 
            type != VTS_WORKER_TYPE_VSWITCH_BEGIN && type != VTS_WORKER_TYPE_VSWITCH_END && type != VTS_WORKER_TYPE_VSWITCH_STORE) {

            length = view.getUint32(index); index += 4;
            str = utils.unint8ArrayToString(new Uint8Array(buffer.buffer, index, length)); index+= length;
            data = JSON.parse(str);
        }
    }

    switch(type) {
        case VTS_WORKER_TYPE_POLYGON:
        case VTS_WORKER_TYPE_FLAT_LINE:
            data.type = type;
            length = view.getUint32(index); index += 4;
            data.vertexBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.vertexBuffer.byteLength;

            if (data['advancedHit']) {
                length = view.getUint32(index); index += 4;
                data.elementBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.elementBuffer.byteLength;
            }

            this.addLineJob(data);
            break;

        case VTS_WORKER_TYPE_FLAT_TLINE:
        case VTS_WORKER_TYPE_FLAT_RLINE:
        case VTS_WORKER_TYPE_PIXEL_LINE:
        case VTS_WORKER_TYPE_PIXEL_TLINE:
            data.type = type;
            length = view.getUint32(index); index += 4;
            data.vertexBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.vertexBuffer.byteLength;
            length = view.getUint32(index); index += 4;
            data.normalBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.normalBuffer.byteLength;

            if (data['advancedHit']) {
                length = view.getUint32(index); index += 4;
                data.elementBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.elementBuffer.byteLength;
            }

            this.addExtentedLineJob(data);
            break;

        case VTS_WORKER_TYPE_LINE_LABEL:

            length = view.getUint32(index); index += 4;
            data.vertexBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.vertexBuffer.byteLength;
            length = view.getUint32(index); index += 4;
            data.texcoordsBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.texcoordsBuffer.byteLength;
            this.addLineLabelJob(data);
            break;

        case VTS_WORKER_TYPE_LINE_LABEL2:

            length = view.getUint32(index); index += 4;
            data.singleBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.singleBuffer.byteLength;
            length = view.getUint32(index); index += 4;
            data.singleBuffer2 = this.copyBuffer(new Float32Array(length), buffer, index); index += data.singleBuffer2.byteLength;
            this.addLineLabelJob(data);
            break;

        case VTS_WORKER_TYPE_ICON:
        case VTS_WORKER_TYPE_LABEL:

            length = view.getUint32(index); index += 4;
            data.singleBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.singleBuffer.byteLength;
            this.addIconJob(data, (type == VTS_WORKER_TYPE_LABEL), tile);
            break;

        case VTS_WORKER_TYPE_ICON2:
        case VTS_WORKER_TYPE_LABEL2:

            length = view.getUint32(index); index += 4;
            data.vertexBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.vertexBuffer.byteLength;
            length = view.getUint32(index); index += 4;
            data.originBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.originBuffer.byteLength;
            length = view.getUint32(index); index += 4;
            data.texcoordsBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.texcoordsBuffer.byteLength;
            this.addIconJob(data, (type == VTS_WORKER_TYPE_LABEL2), tile);
            break;

        case VTS_WORKER_TYPE_POINT_GEOMETRY:
        case VTS_WORKER_TYPE_LINE_GEOMETRY:

            length = view.getUint32(index); index += 4;
            data.geometryBuffer = this.copyBuffer(new Float64Array(length), buffer, index); index += data.originBuffer.byteLength;
            length = view.getUint32(index); index += 4;
            data.indicesBuffer = this.copyBuffer(new Uint32Array(length), buffer, index); index += data.indicesBuffer.byteLength;
            length = view.getUint32(index); index += 4;
            this.addGeometry(data);
            break;

        case VTS_WORKER_TYPE_PACK_BEGIN:
            this.subjobs = []; index += 4;
            break;

        case VTS_WORKER_TYPE_PACK_END:
            this.addPack(); index += 4;
            break;

        case VTS_WORKER_TYPE_VSPOINT:
            this.addVSPoint(data, tile);
            break;

        case VTS_WORKER_TYPE_VSWITCH_BEGIN:
            this.vsjobs = []; this.vsjob = null; index += 4;
            break;

        case VTS_WORKER_TYPE_VSWITCH_END:
            this.addVSwitch(); index += 4;
            break;

        case VTS_WORKER_TYPE_VSWITCH_STORE:
            data = { viewExtent: view.getUint32(index) }; index += 4;
            this.storeVSJobs(data);
            break;

        case VTS_WORKER_TYPE_NODE_BEGIN:

            var node = data;
            node.nodes = [];
            node.jobs = [];
            node.parent = this.currentNode;

            if (node.volume) {
                var p = node.volume.points;
                var points = [
                    p[0][0],p[0][1],p[0][2],
                    p[1][0],p[1][1],p[1][2],
                    p[2][0],p[2][1],p[2][2],
                    p[3][0],p[3][1],p[3][2],
                    p[4][0],p[4][1],p[4][2],
                    p[5][0],p[5][1],p[5][2],
                    p[6][0],p[6][1],p[6][2],
                    p[7][0],p[7][1],p[7][2]
                ];

                node.volume.points2 = points;
            }

            if (this.rootNode) {
                this.currentNode.nodes.push(node);
                this.currentNode = node;
            } else {
                this.rootNode = node;
                this.currentNode = node;

                this.oldJobs = this.jobs;
            }

            this.jobs = node.jobs;

            break;

        case VTS_WORKER_TYPE_NODE_END:

            if (this.currentNode.parent) {
                this.currentNode = this.currentNode.parent;
                this.jobs = this.currentNode.jobs;
            } else {
                this.currentNode = this.currentNode.parent;
                this.jobs = this.oldJobs;
            }

            break;

        case VTS_WORKER_TYPE_MESH:
            this.addMeshJob(data, tile);
            break;

        case VTS_WORKER_TYPE_LOAD_NODE:
            if(this.currentNode) {
                this.currentNode.path = data['path'];
            }
            break;

    }

    return index;
};


GpuGroup.prototype.addRenderJob = function(data, tile) {
    switch(data['type']) {
    case 'polygon':
    case 'flat-line':     this.addLineJob(data); break;
    case 'flat-tline':
    case 'flat-rline':
    case 'pixel-line':
    case 'pixel-tline':    this.addExtentedLineJob(data); break;
    case 'line-label':     this.addLineLabelJob(data); break;
    case 'icon':           this.addIconJob(data); break;
    case 'label':          this.addIconJob(data, true, tile); break;
    case 'point-geometry': this.addGeometry(data); break;
    case 'line-geometry':  this.addGeometry(data); break;
    case 'pack-begin':     this.subjobs = []; break;
    case 'pack-end':       this.addPack(); break;
    case 'vspoint':        this.addVSPoint(data, tile); break;
    case 'vswitch-begin':  this.vsjobs = []; this.vsjob = null; break;
    case 'vswitch-store':  this.storeVSJobs(data); break;
    case 'vswitch-end':    this.addVSwitch(); break;
    case 'node-begin':     this.nodeBegin(); break;
    case 'node-end':       this.nodeEnd(); break;
    case 'mesh':           this.addMesh(); break;
    }
};


function drawLineString(options, renderer) {
    if (options == null || typeof options !== 'object') {
        return this;    
    }

    if (options['points'] == null) {
        return this;    
    }

    var points = options['points'];
    var color = options['color'] || [255,255,255,255];
    var depthOffset = (options['depthOffset'] != null) ? options['depthOffset'] : null;
    var size = options['size'] || 2;
    var screenSpace = (options['screenSpace'] != null) ? options['screenSpace'] : true;
    var depthTest = (options['depthTest'] != null) ? options['depthTest'] : false;
    var blend = (options['blend'] != null) ? options['blend'] : false;
    var writeDepth = (options['writeDepth'] != null) ? options['writeDepth'] : false;
    var useState = (options['useState'] != null) ? options['useState'] : false;

    color = [ color[0] * (1.0/255), color[1] * (1.0/255), color[2] * (1.0/255), color[3] * (1.0/255) ];

    renderer.draw.drawLineString(points, screenSpace, size, color, depthOffset, depthTest, blend, writeDepth, useState);
    return this;    
};


GpuGroup.prototype.getNodeLOD = function(node) {
    var lod = 0;

    while(node.parent) {
        lod++;
        node = node.parent;
    }

    return lod;
};

/*
GpuGroup.prototype.getNodeTexelSize3 = function(node, screenPixelSize) {
    var camera = this.map.camera;
    var cameraDistance = camera.geocentDistance;// * factor;

    var a = vec3.dot(camera.geocentNormal, node.diskNormal); //get angle between tile normal and cameraGeocentNormal
    var d = cameraDistance - (node.diskDistance + (node.maxZ - node.minZ)), d2; //vertical distance from top bbox level

    if (a < node.diskAngle2) { //is camera inside tile conus?
        
        //get horizontal distance
        var a2 = Math.acos(a); 
        var a3 = node.diskAngle2A;
        a2 = a2 - a3; 
        var l1 = Math.tan(a2) * node.diskDistance;// * factor;

        if (d < 0) { //is camera is belown top bbox level?
            d2 = cameraDistance - node.diskDistance;
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
            d2 = cameraDistance - node.diskDistance;
            if (d2 < 0) { //is camera is belown bottom bbox level?
                d = -d2;
            } else { //is camera inside bbox
                return [Number.POSITIVE_INFINITY, 0.1];
            }
        } 
    }

    return [camera.camera.scaleFactor2(d) * screenPixelSize, d];
};


GpuGroup.prototype.getNodeTexelSize2 = function(volume, cameraPos, screenPixelSize, returnDistance) {
    //TODO: 
    //      make camera pos relative to volume center
    //      convert camera pos to volume space
    //      min = [-sizeX*0.5, -sizeY*0.5, -sizeZ*0.5]
    //      max = [sizeX*0.5, sizeY*0.5, sizeZ*0.5]

    var pos = volume.center;
    cameraPos = [cameraPos[0] - pos[0], cameraPos[1] - pos[1], cameraPos[2] - pos[2]];

    var min = cameraPos * volume.m;

    var min = volume.min;
    var min = volume.max;

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
    if (cameraPos[0] > min[0] && cameraPos[0] < max[0] &&
        cameraPos[1] > min[1] && cameraPos[1] < max[1] &&
        cameraPos[2] > min[2] && cameraPos[2] < max[2]) {

        if (returnDistance) {
            return [Number.POSITIVE_INFINITY, 0.1];
        }
    
        return Number.POSITIVE_INFINITY;
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

    if (returnDistance) {
        return [(factor[0] * screenPixelSize), factor[1]];
    }

    return (factor * screenPixelSize);
};
*/


GpuGroup.prototype.getNodeTexelSize = function(node, screenPixelSize) {
    var pos = node.volume.center;
    var cameraPos = this.renderer.cameraPosition;
    var d = vec3.length(
        [pos[0] - cameraPos[0],
         pos[1] - cameraPos[1],
         pos[2] - cameraPos[2]]);

    d -= node.volume.radius;

    if (d <= 0) {
        return [Number.POSITIVE_INFINITY, 0.1];
    }

    return [this.renderer.camera.scaleFactor2(d) * screenPixelSize, d];
};


GpuGroup.prototype.normalizeGE = function(node, ge, lod) {
    if (this.renderer.config.mapNormalizeOctantTexelSize) {

        if (node.volume2) {
            
            //var points = node.volume.points2;
            //rootSize = vec3.length([points[0] - points[3],points[1] - points[4],points[2] - points[5]]);

            node.precision = ge;
            
        } else {

            var points = node.volume.points;

            var rootSize = Math.max(vec3.distance(points[0], points[1]),
                                    vec3.distance(points[0], points[3]),
                                    vec3.distance(points[0], points[4]));

            node.precision = ((rootSize / 256) / this.geFactor) * this.geFactor2;
        }

    }
    
    node.lod = lod;

    for (var i = 0, li = node.nodes.length; i < li; i++) {
        this.normalizeGE(node.nodes[i], ge * 0.5, lod+1);
    }
};


GpuGroup.prototype.getLinePointParametricDist = function(p0, p1, p) {

     var v = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
     var w = [p[0] - p0[0], p[1] - p0[1], p[2] - p0[2]];

     var c1 = vec3.dot(w,v);

     if (c1 <= 0)
          return 0;

     var c2 = vec3.dot(v,v);
     if (c2 <= c1)
          return 1;

     var b = c1 / c2;

     return b;
};


GpuGroup.prototype.getOctant = function(point, points) {
    var fx = this.getLinePointParametricDist(points[0], points[1], point);
    var fy = this.getLinePointParametricDist(points[1], points[2], point);
    var fz = this.getLinePointParametricDist(points[4], points[0], point);

    console.log('' + fx + ' ' + fy + ' ' + fz);

    if (fz > 0.5) {
        if (fy > 0.5) {
            if (fx > 0.5) {
                return 5;
            } else {
                return 4;
            }
        } else {
            if (fx > 0.5) {
                return 7;
            } else {
                return 6;
            }
        }
    } else {
        if (fy > 0.5) {
            if (fx > 0.5) {
                return 1;
            } else {
                return 0;
            }
        } else {
            if (fx > 0.5) {
                return 3;
            } else {
                return 2;
            }
        }
    }

};

GpuGroup.prototype.setDivisionSpace = function(node, points, octant) {
    node.volume2 = { points: points, octant: octant };

    var center = [0,0,0];
    
    for (var i = 0, li = points.length; i < li; i++) {
        center[0] += points[i][0];
        center[1] += points[i][1];
        center[2] += points[i][2];
    }

    center[0] /= li;
    center[1] /= li;
    center[2] /= li;
    
    //node.volume2.center = center;

    var xv = [(points[1][0] - points[0][0])*0.5, (points[1][1] - points[0][1])*0.5, (points[1][2] - points[0][2])*0.5];
    var yv = [(points[1][0] - points[2][0])*0.5, (points[1][1] - points[2][1])*0.5, (points[1][2] - points[2][2])*0.5];
    var zv = [(points[0][0] - points[4][0])*0.5, (points[0][1] - points[4][1])*0.5, (points[0][2] - points[4][2])*0.5];
    var xf, yf, zf;

    for (var i = 0, li = node.nodes.length; i < li; i++) {

        var octant = this.getOctant(node.nodes[i].volume.center, points);

        switch(octant) {
            case 0: xf = -1, yf = -1, zf = -1; break;
            case 1: xf = 0, yf = -1, zf = -1; break;
            case 2: xf = -1, yf = 0, zf = -1; break;
            case 3: xf = 0, yf = 0, zf = -1; break;
            case 4: xf = -1, yf = -1, zf = 0; break;
            case 5: xf = 0, yf = -1, zf = 0; break;
            case 6: xf = -1, yf = 0, zf = 0; break;
            case 7: xf = 0, yf = 0, zf = 0; break;
        }
        
        var p = [center[0] + xv[0] * xf + yv[0] * yf + zv[0] * zf,
                 center[1] + xv[1] * xf + yv[1] * yf + zv[1] * zf,
                 center[2] + xv[2] * xf + yv[2] * yf + zv[2] * zf];

        this.setDivisionSpace(node.nodes[i], [

            [p[0],
             p[1],
             p[2]],

            [p[0] + xv[0],
             p[1] + xv[1],
             p[2] + xv[2]],

            [p[0] + xv[0] + yv[0],
             p[1] + xv[1] + yv[1],
             p[2] + xv[2] + yv[2]],

            [p[0] + yv[0],
             p[1] + yv[1],
             p[2] + yv[2]],

            [p[0] + zv[0],
             p[1] + zv[1],
             p[2] + zv[2]],

            [p[0] + xv[0] + zv[0],
             p[1] + xv[1] + zv[1],
             p[2] + xv[2] + zv[2]],

            [p[0] + xv[0] + yv[0] + zv[0],
             p[1] + xv[1] + yv[1] + zv[1],
             p[2] + xv[2] + yv[2] + zv[2]],

            [p[0] + yv[0] + zv[0],
             p[1] + yv[1] + zv[1],
             p[2] + yv[2] + zv[2]]

        ], octant);

    }
};

GpuGroup.prototype.drawMeshNodes = function(node, visible, isready, skipRender) {

    var renderer = this.renderer;
    var points = node.volume.points2;
    var cameraPos = this.renderer.cameraPosition;

    if (!visible && !renderer.camera.pointsVisible(points, cameraPos)) {
        return;        
    }

    var ready = true;
    var nodes = node.nodes;
    var visible = [];

    for (var i = 0, li = nodes.length; i < li; i++) {
        //visible[i] = renderer.camera.pointsVisible(nodes[i].volume.points2, cameraPos);

        //if (visible[i]) {
            if (!this.isNodeReady(nodes[i])) {
                ready = false;
            }
        //}
    }


    if (ready) {
        for (var i = 0, li = nodes.length; i < li; i++) {
            //if (visible[i]) {
                //this.traverseNode(nodes[i], true, true);
                this.traverseNode(nodes[i]);
            //}
        }
    } else { // children are not ready, draw parent as fallback

        //if (this.isNodeReady(node)) {
            this.drawNode(node);
        //}

    }


};


GpuGroup.prototype.traverseNode = function(node, visible, isready, skipRender) {

    var renderer = this.renderer;
    var points = node.volume.points2;
    var cameraPos = this.renderer.cameraPosition;

    if (!visible && !renderer.camera.pointsVisible(points, cameraPos)) {
        return;        
    }

    var res = this.getNodeTexelSize(node, node.precision * renderer.curSize[0] * this.geFactor);

    //this.loadMode = 0;

    if (this.loadMode == 0) { // topdown

        if (!node.nodes.length || (res[0] <= this.map.draw.texelSizeFit && (node.jobs.length || !this.map.config.mapTraverseToMeshNode))) {

            if (node.parent || this.isNodeReady(node, null, null, null, true)) { 
                this.drawNode(node);
            }

        } else {

            //are nodes ready
            var ready = true;
            var nodes = node.nodes;
            var visible = [];

            for (var i = 0, li = nodes.length; i < li; i++) {
                //visible[i] = renderer.camera.pointsVisible(nodes[i].volume.points2, cameraPos);

                //if (visible[i]) {
                    if (!this.isNodeReady(nodes[i])) {
                        ready = false;
                    }
                //}
            }


            if (ready) {
                for (var i = 0, li = nodes.length; i < li; i++) {
                    //if (visible[i]) {
                        //this.traverseNode(nodes[i], true, true);
                        this.traverseNode(nodes[i]);
                    //}
                }
            } else { // children are not ready, draw parent as fallback

                //if (this.isNodeReady(node)) {
                    this.drawNode(node);
                //}

            }

        }

    } else if (this.loadMode == 1) { // topdown with splitting

        var priority = node.lod * res[1];

        if (!node.nodes.length || (res[0] <= this.map.draw.texelSizeFit && (node.jobs.length || !this.map.config.mapTraverseToMeshNode))) {

            if (!skipRender && (/*node.parent ||*/ this.isNodeReady(node, null, priority, null, true))) { 
                this.drawNode(node);
            }

        } else {

            //are nodes ready
            var ready = true;
            var nodes = node.nodes;
            var mask = [0,0,0,0,0,0,0,0];
            var useMask = false;
            var readyCount = 0;
            var splitLods = this.map.config.mapSplitLods;

            var priority2 = (node.lod+1) * res[1];

            for (var i = 0, li = nodes.length; i < li; i++) {

                if (splitLods) {
                    var node2 = nodes[i];
                    var res2 = this.getNodeTexelSize(node2, node.precision * renderer.curSize[0] * this.geFactor);
                    node2.goodLod = (res2[0] <= this.map.draw.texelSizeFit);
                }

                if (renderer.camera.pointsVisible(nodes[i].volume.points2, cameraPos)) {
                    nodes[i].visible = true;
                } else {
                    nodes[i].visible = false;
                    continue;
                }

                if (!this.isNodeReady(nodes[i], null, priority2, true, skipRender) || (splitLods && node2.goodLod)) {
                    //ready = false;
                    useMask = true;
                    mask[nodes[i].volume2.octant] = 1;
                } else {
                    readyCount++;
                }
            }

            for (var i = 0, li = nodes.length; i < li; i++) {
                if (nodes[i].visible && !(splitLods && nodes[i].goodLod)) {
                    //this.traverseNode(nodes[i], true, true);
                    var skipChildRender = (skipRender || (mask[nodes[i].volume2.octant] == 1));
                    this.traverseNode(nodes[i], true, null, skipChildRender);
                }
            }

            if (useMask) { // some children are not ready, draw parent as fallback
                if (!skipRender && this.isNodeReady(node, null, priority, null, true)) {
                    if (readyCount > 0) {
                        this.drawNode(node, null, mask, node.volume2.points);
                    } else {
                        this.drawNode(node);
                    }
                }
            }

        }

    } else if (this.loadMode == 2) { // fit

        if (!node.nodes.length || res[0] <= this.map.draw.texelSizeFit) {

            if (isready || this.isNodeReady(node)) {
                this.drawNode(node);
            } else { //node is not ready, try childen

                var nodes = node.nodes;

                for (var i = 0, li = nodes.length; i < li; i++) {
                    if (renderer.camera.pointsVisible(nodes[i].volume.points2, cameraPos)) {
                        if (this.isNodeReady(nodes[i], true)) {
                            this.drawNode(node);
                        }
                    }
                }

            }

        } 

        else if (res[0] <= this.map.draw.texelSizeFit*2) {

            //are nodes ready
            var ready = true;
            var nodes = node.nodes;
            var visible = [];

            for (var i = 0, li = nodes.length; i < li; i++) {
                visible[i] = renderer.camera.pointsVisible(nodes[i].volume.points2, cameraPos);

                if (visible[i]) {
                    if (!this.isNodeReady(nodes[i])) {
                        ready = false;
                    }
                }
            }

            if (ready) {
                for (var i = 0, li = nodes.length; i < li; i++) {
                    if (visible[i]) {
                        this.traverseNode(nodes[i], true, true);
                    }
                }
            } else { // children are not ready, draw parent as fallback

                //if (this.isNodeReady(node)) {
                    this.drawNode(node);
                //}

            }

        } else {

            for (var i = 0, li = node.nodes.length; i < li; i++) {
                this.traverseNode(node.nodes[i]);
            }
        }

    } else if (this.loadMode == 3) { // fitonly

        if (!node.nodes.length || res[0] <= this.map.draw.texelSizeFit) {

            if (this.isNodeReady(node)) {
                this.drawNode(node);
            }

        } else {
            for (var i = 0, li = node.nodes.length; i < li; i++) {
                this.traverseNode(node.nodes[i]);
            }
        }
    }

};


GpuGroup.prototype.isNodeReady = function(node, doNotLoad, priority, skipGpu, skipStats) {
    var jobs = node.jobs;
    var ready = true;

    if (node.loading) {
        return false;
    } else {    
        if (node.path) {
            node.loading = true;

            var builder = new MapGeodataBuilder(this.map);
            var importer = new MapGeodataImport3DTiles(builder);
            importer.loadJSON(node.path, { gradualJSONLoader:true }, this.onLoadNodeLoaded.bind(this, node, builder, null, true));

            node.path = null;
            return false;
        }
    }

    //return true;

    for (var i = 0, li = jobs.length; i < li; i++) {
        var job = jobs[i];
        
        if (job.type == VTS_JOB_MESH) {
            if (!this.isMeshReady(job, doNotLoad, priority, skipGpu, skipStats, node)) {
                ready = false;
            }
        }
    }

    return ready;
};


GpuGroup.prototype.directParseNode = function(node, lod, first) {
    if (!first) {
        this.addRenderJob2(null, null, this.tile, { type: VTS_WORKER_TYPE_NODE_BEGIN, data: {'volume': node.volume, 'precision': node.precision, 'tileset': node.tileset }});
        this.currentNode.lod = lod;
    }

    var meshes = node['meshes'] || [];
    var i, li;

    //loop elements
    for (i = 0, li = meshes.length; i < li; i++) {
        this.addRenderJob2(null, null, this.tile, { type: VTS_WORKER_TYPE_MESH, data: { 'path':meshes[i] } });
    }

    var nodes = node['nodes'] || [];

    for (i = 0, li = nodes.length; i < li; i++) {
        this.directParseNode(nodes[i], lod+1);
        
        /*if (first && this.rootNode) { //renormalize root precision
            var rootPrecision = nodes[i].precision * Math.pow(2.0, lod+1);
            
            if(rootPrecision > this.rootNode.precision) {
                this.rootNode.precision = rootPrecision;
            }
        }*/
    }

    var loadNodes = node['loadNodes'] || [];

    for (i = 0, li = loadNodes.length; i < li; i++) {
        this.addRenderJob2(null, null, this.tile, { type: VTS_WORKER_TYPE_LOAD_NODE, data: { 'path':loadNodes[i] } });
    }

    if (!first) {
        this.addRenderJob2(null, null, this.tile, { type: VTS_WORKER_TYPE_NODE_END, data: {} });

        this.map.stats.octoNodes++;
        this.map.stats.octoNodesMemSize += 3264 - (meshes.length ? 0 : 1740);
    }
};


GpuGroup.prototype.onLoadNodeLoaded = function(node, builder, data) {
    var nodes = builder.nodes;
    var oldCurrentNode = this.currentNode;
    this.currentNode = node;
    this.jobs = node.jobs;
    
    for (var i = 0, li = nodes.length; i < li; i++) {
        this.directParseNode(nodes[i], node.lod, true);
    }

    this.currentNode = oldCurrentNode;
    this.jobs = oldCurrentNode ? oldCurrentNode.jobs : [];

    if (node.volume2) {
        this.setDivisionSpace(node, node.volume2.points, node.volume2.octant);
    }

    if (this.rootNode) {
        this.normalizeGE(this.rootNode, this.rootPrecision, this.rootNode.lod);
    } else {
        this.normalizeGE(node, node.precision, node.lod);
    }
    
    this.renderer.core.map.dirty = true;
    
    node.loading = false;
};


GpuGroup.prototype.drawNodeVolume = function(points, color) {
    var renderer = this.renderer;

    drawLineString({
        points : [points[0], points[1], points[2], points[3], points[0],
                  points[4], points[5], points[6], points[7], points[4]
        ],
        size : 1.0,
        color : color,
        depthTest : false,
        //depthTest : true,
        //depthOffset : [-0.01,0,0],
        screenSpace : false, //switch to physical space
        blend : false
        }, renderer);

    drawLineString({
        points : [points[1], points[5]],
        size : 1.0,
        color : color,
        depthTest : false,
        //depthTest : true,
        //depthOffset : [-0.01,0,0],
        screenSpace : false, //switch to physical space
        blend : false
        }, renderer);

    drawLineString({
        points : [points[2], points[6]],
        size : 1.0,
        color : color,
        depthTest : false,
        //depthTest : true,
        //depthOffset : [-0.01,0,0],
        screenSpace : false, //switch to physical space
        blend : false
        }, renderer);

    drawLineString({
        points : [points[3], points[7]],
        size : 1.0,
        color : color,
        depthTest : false,
        //depthTest : true,
        //depthOffset : [-0.01,0,0],
        screenSpace : false, //switch to physical space
        blend : false
        }, renderer);
}

GpuGroup.prototype.drawNode = function(node, noSkip, splitMask, splitSpace) {
    var renderer = this.renderer;
    var debug = this.map.draw.debug;
    var jobs = node.jobs;

    renderer.drawnNodes++;

    if (debug.drawNBBoxes) {
        var points = node.volume.points;
        var color = [255,0,255,255];

        if (node.tileset) {
            color = [0,255,0,255];           
        }

        if (noSkip) {
            color = [255,255,0,255];
        }
                 
        if (debug.drawSpaceBBox && node.volume2) {
            this.drawNodeVolume(node.volume2.points, [255,0,0,255]);
        } else {
            this.drawNodeVolume(points, color);
        }

        /*
        for (var i = 0, li = node.nodes.length; i < li; i++) {
            var node2 = node.nodes[i];

            if (node2.volume2.octant == 7) {
                this.drawNodeVolume(node2.volume2.points, [255,0,0,255]);
            }
        }*/

        var cameraPos = this.renderer.cameraPosition;
        var pos = node.volume.center;

        var shift = [cameraPos[0] - pos[0],
               cameraPos[1] - pos[1],
               cameraPos[2] - pos[2]];

        vec3.normalize(shift);
        vec3.scale(shift, node.volume.radius);

        pos = [pos[0]+shift[0]-cameraPos[0],  
               pos[1]+shift[1]-cameraPos[1],
               pos[2]+shift[2]-cameraPos[2]];

        /*pos = [pos[0]-cameraPos[0],  
               pos[1]-cameraPos[1],
               pos[2]-cameraPos[2]];*/

        pos = this.renderer.core.getRendererInterface().getCanvasCoords(
            pos,
            /*[pos[0] - cameraPos[0],
             pos[1] - cameraPos[1],
             pos[2] - cameraPos[2]],*/
             this.renderer.camera.getMvpMatrix());

        var factor = 2, text;

        if (debug.drawLods) {
            text = '' + node.lod;//this.getNodeLOD(node);
            renderer.draw.drawText(Math.round(pos[0]-renderer.draw.getTextSize(4*factor, text)*0.5), Math.round(pos[1]-4*factor), 4*factor, text, [1,0,0,1], pos[2]);

            text = '' + node.lod;//this.getNodeLOD(node);
            renderer.draw.drawText(Math.round(pos[0]-renderer.draw.getTextSize(4*factor, text)*0.5), Math.round(pos[1]-4*factor), 4*factor, text, [1,1,0,1], pos[2]);
        }
        
        if (debug.drawDistance) {
            var res = this.getNodeTexelSize(node, node.precision * renderer.curSize[0]);
            text = '' + res[1].toFixed(2) + ' ' + res[0].toFixed(2) + ' ' + node.precision.toFixed(3);
            renderer.draw.drawText(Math.round(pos[0]-renderer.draw.getTextSize(4*factor, text)*0.5), Math.round(pos[1]+17*factor), 4*factor, text, [0.5,0.5,1,1], pos[2]);
        }

        if (debug.drawFaceCount) {
            var mesh = (jobs[0] && jobs[0].type == VTS_JOB_MESH) ? jobs[0].mesh : null;
            if (mesh) {
                text = '' + mesh.faces + ' - ' + mesh.submeshes.length;
                renderer.draw.drawText(Math.round(pos[0]-renderer.draw.getTextSize(4*factor, text)*0.5), Math.round(pos[1]+10*factor), 4*factor, text, [0,1,0,1], pos[2]);
            }
        }

        if (debug.drawResources && jobs[0]) {
            text = '' + (this.getGpuSize(jobs[0])/(1024*1024)).toFixed(2) + 'MB';
            renderer.draw.drawText(Math.round(pos[0]-renderer.draw.getTextSize(4*factor, text)*0.5), Math.round(pos[1]+3*factor), 4*factor, text, [0,1,0,1], pos[2]);
        }

        if (debug.drawSurfaces && jobs[0]) {
            var text = '';

            var mesh = (jobs[0] && jobs[0].type == VTS_JOB_MESH) ? jobs[0].mesh : null;
            if (mesh) {
                var path = mesh.mapLoaderUrl;
                path = path.replace('.mesh', '');
                var parts = path.split('/');

                if (parts.length > 1) {
                    text = parts[parts.length-2] + '/' + parts[parts.length-1];
                } else {
                    text = parts[0];
                }
            }

            renderer.draw.drawText(Math.round(pos[0]-renderer.draw.getTextSize(4*factor, text)*0.5), Math.round(pos[1]+10*factor), 4*factor, text, [0,1,0,1], pos[2]);
        }

        if (debug.drawTextureSize) {
            var mesh = (jobs[0] && jobs[0].type == VTS_JOB_MESH) ? jobs[0].mesh : null;
            if (mesh) {
                var submeshes = mesh.submeshes;
                for (i = 0, li = submeshes.length; i < li; i++) {

                    if (submeshes[i].internalUVs) {
                        var texture;
                        if (jobs[0].direct) {
                            texture = submeshes[i].texture;
                        } else {
                            texture = jobs[0].textures[i];
                        }
                        
                        if (texture) {
                            var gpuTexture = texture.getGpuTexture();
                            if (gpuTexture) {
                                text = '[' + i + ']: ' + gpuTexture.width + ' x ' + gpuTexture.height;
                                renderer.draw.drawText(Math.round(pos[0]-renderer.draw.getTextSize(4*factor, text)*0.5), Math.round(pos[1]+(17+i*4*2)*factor), 4*factor, text, [1,1,1,1], pos[2]);
                            }
                        }
                    } else {
                        text = '[' + i + ']: 256 x 256';
                        renderer.draw.drawText(Math.round(pos[0]-renderer.draw.getTextSize(4*factor, text)*0.5), Math.round(pos[1]+(17+i*4*2)*factor), 4*factor, text, [1,1,1,1], pos[2]);
                    }
                }
            }
        }
    }

    //debug.drawNBBoxes = true;

    if (!noSkip) {
        //return true;
    }

    for (var i = 0, li = jobs.length; i < li; i++) {
        var job = jobs[i];
        
        if (job.type == VTS_JOB_MESH) {

            if (this.isMeshReady(job, null, null, null, true, node)) {
                this.drawMesh(job, node, splitMask, splitSpace);
            }
        }
    }

};


GpuGroup.prototype.isMeshReady = function(job, doNotLoad, priority, skipGpu, skipStats, node) {
    var mesh = job.mesh;
    var submeshes = mesh.submeshes;
    var ready = true;
    var stats = this.map.stats;

    //console.log('' + stats.gpuNeeded + '  ' + job.texturePath);

    if (mesh.isReady(doNotLoad, priority, skipGpu)) {
        if (!skipStats) {
            stats.gpuNeeded += mesh.gpuSize;
            
            //if (job.texturePath) {
                //console.log('--' + node.lod + '--' + job.texturePath + '    ' + stats.gpuNeeded);
            //}
        }

        for (var i = 0, li = submeshes.length; i < li; i++) {
            var submesh = submeshes[i];
            
            if (submesh.internalUVs) {
                
                var texture;

                if (job.direct) {
                    if (!submesh.texture) {
                        var path = mesh.mapLoaderUrl;
                        path = path.replace('.mesh', '-' + i + '.jpg');
                        var resource = new MapResourceNode(this.renderer.core.map, null, null);
                        submesh.texture = resource.getTexture(path, VTS_TEXTURETYPE_COLOR, null, null, null /*tile*/, true);
                    }
                    
                    texture = submesh.texture;
                } else {
                    if (!job.texturePath) {
                        continue;
                    }

                    if (!job.textures[i]) {
                        var path = job.texturePath + '-' + i + '.jpg';
                        job.textures[i] = job.resources.getTexture(path, VTS_TEXTURETYPE_COLOR, null, null, null /*tile*/, true);
                    } 
                    
                    texture = job.textures[i];
                }


                if (!texture.isReady(doNotLoad, priority, skipGpu)) {
                    ready = false;
                }

                if (!skipStats) {
                    stats.gpuNeeded += texture.getGpuSize();
                }
            }
        }

    } else {
        ready = false;
    }

    //console.log('' + stats.gpuNeeded + '  finish');

    return ready;
}


GpuGroup.prototype.getGpuSize = function(job) {
    var mesh = job.mesh;

    if (!mesh) return 0;

    var submeshes = mesh.submeshes;
    var size = 0;
    var doNotLoad = true;

    if (mesh.isReady(doNotLoad)) {
        size += mesh.gpuSize;

        for (var i = 0, li = submeshes.length; i < li; i++) {
            var submesh = submeshes[i];
            
            if (submesh.internalUVs && job.texturePath) {
                if (job.textures[i]) {
                    size += job.textures[i].getGpuSize();
                }
            }
        }
    }

    return size;
}


GpuGroup.prototype.drawMesh = function(job ,node, splitMask, splitSpace) {
    var mesh = job.mesh;
    var submeshes = mesh.submeshes;
    var cameraPos = this.renderer.cameraPosition;

    for (var i = 0, li = submeshes.length; i < li; i++) {
        var submesh = submeshes[i];
        
        if (job.direct) {
            if (submesh.texture) {
                mesh.drawSubmesh(cameraPos, i, submesh.texture, VTS_MATERIAL_INTERNAL /*type*/, null /*alpha*/, null /*layer*/, null /*surface*/,  splitMask, splitSpace);
            }
        } else {
            if (job.textures[i]) {
                mesh.drawSubmesh(cameraPos, i, job.textures[i], VTS_MATERIAL_INTERNAL /*type*/, null /*alpha*/, null /*layer*/, null /*surface*/,  splitMask, splitSpace);
            }
        }
    }
}


/*GpuGroup.prototype.testNodes = function(node) {
    var p = node.volume.points;

    var xa1 = p[7], xa2 = p[6];
    var ya1 = p[7], ya2 = p[0];
    var za1 = p[7], za2 = p[4];

    p = p[7];

    var getAxisPos = (function(pp, a1, a2){
        var v = [a2[0] - a1[0], a2[1] - a1[1], a2[2] - a1[2] ];
        var w = [pp[0] - a1[0], pp[1] - a1[1], pp[2] - a1[2] ];

        var c1 = vec3.dot(w,v);
        if (c1 <= 0) return 0;

        var c2 = vec3.dot(v,v);
        if (c2 <= c1) return 1;

        return c1 / c2;
    });

    var getPos = (function(pp){
        console.log('axis-x ' + getAxisPos(pp, xa1, xa2));
        console.log('axis-y ' + getAxisPos(pp, ya1, ya2));
        console.log('axis-z ' + getAxisPos(pp, za1, za2));
    });

    for (var i = 0, li = node.nodes.length; i < li; i++) {
        console.log('node' + i);

        var volume = node.nodes[i].volume;

        getPos(volume.center);
    }

};


GpuGroup.prototype.testNodes3 = function(node) {
    this.drawNode(node);

    for (var i = 0, li = node.nodes.length; i < li; i++) {
        var node2 = node.nodes[i];

        this.drawNode(node2);

        for (var j = 0, lj = node2.nodes.length; j < lj; j++) {
            var node3 = node2.nodes[j];

            this.drawNode(node3);

            for (var k = 0, lk = node3.nodes.length; k < lk; k++) {
                this.drawNode(node3.nodes[k], k == 0);
            }

        }
    }
};


GpuGroup.prototype.testNodes2 = function(node, depth) {
    
    if (depth == 0)
        this.drawNode(node);

    for (var i = 0, li = node.nodes.length; i < li; i++) {
        var node2 = node.nodes[i];
        this.testNodes2(node2, depth + 1)
    }
};*/


GpuGroup.prototype.traverseBinNode = function(points, center, radius, texelSize, lod, index, file, visible, isready, skipRender) {
    
    var renderer = this.renderer;
    var cameraPos = this.renderer.cameraPosition;

    if (!visible && !renderer.camera.pointsVisible2(points, cameraPos)) {
        return;        
    }

    var index2 = index * 9;
    var tree = file.tree;

    var res = this.getBinNodeTexelSize(center, radius, texelSize * renderer.curSize[0]);

    var pathFlags = tree[index2];
    var pathIndex = (pathFlags & 0xfffffff);
    
    if (pathFlags & (1 << 31)) {  // has json, jump to another tree (bin file) 
        var tab = file.pathTable;
        
        if (tab[pathIndex] == 2) { //loaded
            var fileIndex = tab[pathIndex+1] | tab[pathIndex+2] << 8 | tab[pathIndex+3] << 16; // | | tab[pathIndex+3] << 24;
            file = this.binFiles[fileIndex];
            tree = file.tree;
            index = 0;
            index2 = 0;
            pathFlags = tree[index2];
            pathIndex = (pathFlags & 0xfffffff);
        } else {
            return;
        }
    }
        
    var hasMesh = (pathIndex != 0); 

    if (this.loadMode == 1) { // topdown with splitting

        var priority = lod * res[1];
        
        var noChildren = (!tree[index2+1] && !tree[index2+2] && !tree[index2+3] && !tree[index2+4] &&
                          !tree[index2+5] && !tree[index2+6] && !tree[index2+7] && !tree[index2+8]);

        if (noChildren || (res[0] <= this.map.draw.texelSizeFit && (hasMesh || !this.map.config.mapTraverseToMeshNode))) {

            if (!skipRender && (/*node.parent ||*/ this.isBinNodeReady(points, center, index, file, null, priority, null, true))) { 

                var node = {
                    lod : lod,
                    precision: texelSize,
                    volume: {
                        points: points,
                        center: center,
                        radius: radius,
                    },
                    jobs: hasMesh ? [
                        {
                            type: VTS_JOB_MESH,
                            mesh: file.meshes[index],
                            direct: true
                        }
                    ] : []
                };

                this.drawNode(node);
            }

        } else {

            //are nodes ready
            var ready = true;
            var mask = [0,0,0,0,0,0,0,0];
            var childPointsCache = [];
            var childCenterCache = [];
            var useMask = false;
            var readyCount = 0;
            var splitLods = this.map.config.mapSplitLods;

            var childPriority = (lod+1) * res[1];

            var xv = [(points[1][0] - points[0][0])*0.5, (points[1][1] - points[0][1])*0.5, (points[1][2] - points[0][2])*0.5];
            var yv = [(points[1][0] - points[2][0])*0.5, (points[1][1] - points[2][1])*0.5, (points[1][2] - points[2][2])*0.5];
            var zv = [(points[0][0] - points[4][0])*0.5, (points[0][1] - points[4][1])*0.5, (points[0][2] - points[4][2])*0.5];
            var xf, yf, zf;

            for (var i = 0, li = 8; i < li; i++) {

                var childIndex = tree[index2 + 1 + i];
                
                if (childIndex) {
                    var childIndex2 = childIndex * 9;
/*
                    switch(i) {
                        case 0: xf = -1, yf = -1, zf = -1; break;
                        case 1: xf = 0, yf = -1, zf = -1; break;
                        case 2: xf = -1, yf = 0, zf = -1; break;
                        case 3: xf = 0, yf = 0, zf = -1; break;
                        case 4: xf = -1, yf = -1, zf = 0; break;
                        case 5: xf = 0, yf = -1, zf = 0; break;
                        case 6: xf = -1, yf = 0, zf = 0; break;
                        case 7: xf = 0, yf = 0, zf = 0; break;
                    }
*/
                    switch(i) {
                        case 0: xf = -1, yf = -1, zf = -1; break;
                        case 1: xf = 0, yf = -1, zf = -1; break;
                        case 2: xf = -1, yf = 0, zf = -1; break;
                        case 3: xf = 0, yf = 0, zf = -1; break;
                        case 4: xf = -1, yf = -1, zf = 0; break;
                        case 5: xf = 0, yf = -1, zf = 0; break;
                        case 6: xf = -1, yf = 0, zf = 0; break;
                        case 7: xf = 0, yf = 0, zf = 0; break;
                    }


                    var p = [center[0] + xv[0] * xf + yv[0] * yf + zv[0] * zf,
                             center[1] + xv[1] * xf + yv[1] * yf + zv[1] * zf,
                             center[2] + xv[2] * xf + yv[2] * yf + zv[2] * zf];

                    var childPoints = [

                        [p[0],
                         p[1],
                         p[2]],

                        [p[0] + xv[0],
                         p[1] + xv[1],
                         p[2] + xv[2]],

                        [p[0] + xv[0] + yv[0],
                         p[1] + xv[1] + yv[1],
                         p[2] + xv[2] + yv[2]],

                        [p[0] + yv[0],
                         p[1] + yv[1],
                         p[2] + yv[2]],

                        [p[0] + zv[0],
                         p[1] + zv[1],
                         p[2] + zv[2]],

                        [p[0] + xv[0] + zv[0],
                         p[1] + xv[1] + zv[1],
                         p[2] + xv[2] + zv[2]],

                        [p[0] + xv[0] + yv[0] + zv[0],
                         p[1] + xv[1] + yv[1] + zv[1],
                         p[2] + xv[2] + yv[2] + zv[2]],

                        [p[0] + yv[0] + zv[0],
                         p[1] + yv[1] + zv[1],
                         p[2] + yv[2] + zv[2]]

                    ];

                    var childCenter = [ (childPoints[0][0]+childPoints[1][0]+childPoints[2][0]+childPoints[3][0]+childPoints[4][0]+childPoints[5][0]+childPoints[6][0]+childPoints[7][0])/8,
                                   (childPoints[0][1]+childPoints[1][1]+childPoints[2][1]+childPoints[3][1]+childPoints[4][1]+childPoints[5][1]+childPoints[6][1]+childPoints[7][1])/8,
                                   (childPoints[0][2]+childPoints[1][2]+childPoints[2][2]+childPoints[3][2]+childPoints[4][2]+childPoints[5][2]+childPoints[6][2]+childPoints[7][2])/8 ];

/*
                    var childCenter = [p[0] + xv[0]*0.5 + yv[0]*0.5 + zv[0]*0.5,
                                       p[1] + xv[1]*0.5 + yv[1]*0.5 + zv[1]*0.5,
                                       p[2] + xv[2]*0.5 + yv[2]*0.5 + zv[2]*0.5];
*/                                       
                    childPointsCache[i] = childPoints;
                    childCenterCache[i] = childCenter;

                    if (splitLods) {
                        var res2 = this.getBinNodeTexelSize(childCenter, radius*0.5, texelSize*0.5 * renderer.curSize[0]);
                        if (res2[0] <= this.map.draw.texelSizeFit) {
                            tree[childIndex2] |= (1 << 29);  // set good lod flag true
                        } else {
                            tree[childIndex2] &= ~(1 << 29);  // set good lod flag false
                        }
                    }

                    if (renderer.camera.pointsVisible2(childPoints, cameraPos)) {
                        tree[childIndex2] |= (1 << 30);  // set visible flag true
                    } else {
                        tree[childIndex2] &= ~(1 << 30);  // set visible flag false
                        continue;
                    }

                    if (!this.isBinNodeReady(childPoints, childCenter, childIndex, file, null, childPriority, true, skipRender) || (splitLods && (tree[index2] & (1 << 29) /* good lod flag*/ ))) {
                        //ready = false;
                        useMask = true;
                        mask[i] = 1;
                    } else {
                        readyCount++;
                    }
                }
            }

            for (var i = 0, li = 8; i < li; i++) {
                var childIndex = tree[index2 + 1 + i];
                
                if (childIndex) {
                    var childIndex2 = childIndex * 9;

                    if ((tree[childIndex2] & (1 << 30) /* visibility flag*/ ) && !(splitLods && (tree[childIndex2] & (1 << 29) /* good lod flag*/ ))) {
                        var skipChildRender = (skipRender || (mask[i] == 1));

                        this.traverseBinNode(childPointsCache[i], childCenterCache[i], radius * 0.5, texelSize * 0.5, lod+1, childIndex, file, true, null, skipChildRender);
                    }
                }
            }

            if (useMask) { // some children are not ready, draw parent as fallback
                if (!skipRender && this.isBinNodeReady(points, center, index, file, null, priority, null, true)) {
                    
                    var node = {
                        lod : lod,
                        precision: texelSize,
                        volume: {
                            points: points,
                            center: center,
                            radius: radius,
                        },
                        jobs: hasMesh ? [
                            {
                                type: VTS_JOB_MESH,
                                mesh: file.meshes[index],
                                direct: true
                            }
                        ] : []
                    };
                    
                    if (readyCount > 0) {
                        this.drawNode(node, null, mask, points);
                    } else {
                        this.drawNode(node);
                    }
                }
            }

        }
    }
    
};


GpuGroup.prototype.getPath = function(tab, index) {
    var stmp = '';
    while(tab[index] != 0) {
        stmp += String.fromCharCode(tab[index++]);
        if (stmp.length > 700) {
            debugger
        }
    }
    
    return stmp;
};


GpuGroup.prototype.isBinNodeReady = function(points, center, index, file, doNotLoad, priority, skipGpu, skipStats) {
    var ready = true;

    var tree = file.tree;
    var index2 = index * 9;
    var pathFlags = tree[index2];
    var pathIndex = (pathFlags & 0xfffffff);

    if (pathFlags & (1 << 31)) {  // has json, jump to another tree (bin file) 
        var tab = file.pathTable;
        
        if (tab[pathIndex] == 2) { //loaded
            var fileIndex = tab[pathIndex+1] | tab[pathIndex+2] << 8 | tab[pathIndex+3] << 16;// | tab[pathIndex+4] << 24;
            file = this.binFiles[fileIndex];
            tree = file.tree;
            index = 0;
            index2 = 0;
            pathFlags = tree[index2];
            pathIndex = (pathFlags & 0xfffffff);
        } else {

            if (tab[pathIndex] == 0) { 
                tab[pathIndex] = 1;

                this.binFiles.push({});

                var path = this.getPath(tab, pathIndex+4);
                path = utilsUrl.getProcessUrl(path, this.rootPath);

                if (localTest) {
                    var importer = new MapGeodataImport3DTiles2();
                    importer.navSrs = this.map.getNavigationSrs();
                    importer.physSrs = this.map.getPhysicalSrs();
                    importer.srs = importer.navSrs;

                    importer.loadJSON(path + '.json', {index: this.binFiles.length-1, nodeFile:file.index, nodeOffset:pathIndex, root: false}, this.onBinFileLoaded.bind(this));
                } else {
                    this.map.loader.processLoadBinary(path + '.json', this.onBinFileLoaded.bind(this,{index: this.binFiles.length-1, nodeFile:file.index, nodeOffset:pathIndex }), null, "text", 'direct-3dtiles', {root: false});
                }
            }

            return false;
        }
    }

    var hasMesh = (pathIndex != 0); 

    if (hasMesh) {
        if (!file.meshes[index]) {
            var path = this.getPath(file.pathTable, pathIndex);
            path = utilsUrl.getProcessUrl(path, this.rootPath);
            var resource = new MapResourceNode(this.renderer.core.map, null, null);
            file.meshes[index] = resource.getMesh(path + '.mesh', null);
            //file.textures[index] = resource.getTexture(path + '-0.jpg', VTS_TEXTURETYPE_COLOR, null, null, null /*tile*/, true);
        }
        
        var job = {
            mesh: file.meshes[index],
            //textures: [file.textures[index]],
            direct: true
        };
        
        if (!this.isMeshReady(job, doNotLoad, priority, skipGpu, skipStats /*, node*/)) {
            ready = false;
        }
    }

    return ready;
};


GpuGroup.prototype.getBinNodeTexelSize = function(pos, radius, screenPixelSize) {
    var cameraPos = this.renderer.cameraPosition;
    var d = vec3.length(
        [pos[0] - cameraPos[0],
         pos[1] - cameraPos[1],
         pos[2] - cameraPos[2]]);

    d -= radius;

    if (d <= 0) {
        return [Number.POSITIVE_INFINITY, 0.1];
    }

    return [this.renderer.camera.scaleFactor2(d) * screenPixelSize, d];
};


GpuGroup.prototype.onBinFileLoaded = function(info, data) {
    var binFile = this.binFiles[info.index];
    binFile.loadState = 2;
    binFile.tree = data.bintree;
    binFile.pathTable = data.pathTable;
    binFile.rootSize = data.rootSize;
    binFile.meshes = new Array(data.totalNodes);
    binFile.index = info.index;

    this.map.stats.octoNodes += data.totalNodes;
    this.map.stats.octoNodesMemSize += binFile.tree.byteLength + binFile.pathTable.byteLength + 
                                       binFile.meshes.length*4 + 8*2 + 16*2 + 24;

    if (info.nodeOffset) {
        var tab = this.binFiles[info.nodeFile].pathTable;
        tab[info.nodeOffset] = 2; //load state
        tab[info.nodeOffset+1] = (info.index & 0xff);
        tab[info.nodeOffset+2] = (info.index >> 8) & 0xff;
        tab[info.nodeOffset+3] = (info.index >> 16) & 0xff;
        //table[info.nodeOffset+3] = (info.index >> 24) & 0xff;
    }

    if (info.root) {
        this.rootPoints = data.points;
        this.rootCenter = data.center;
        this.rootRadius = data.radius;
        this.rootTexelSize = data.texelSize;
    }

    this.renderer.core.map.dirty = true;
};


GpuGroup.prototype.draw = function(mv, mvp, applyOrigin, tiltAngle, texelSize) {
    if (this.id != null) {
        if (this.renderer.layerGroupVisible[this.id] === false) {
            return;
        }
    }

    var renderer = this.renderer;
    var renderCounter = [[renderer.geoRenderCounter, mv, mvp, this]];
    var map = renderer.core.map;
    this.map = map;
    
    if (this.binPath) {
        
        if (this.binFiles.length == 0) {
            this.binFiles.push(
                {
                    loadState : 1
                } 
            );

            this.rootPath = utilsUrl.makeAbsolute(this.binPath);
            this.rootPath = utilsUrl.getBase(this.rootPath);

            if (localTest) {
                var importer = new MapGeodataImport3DTiles2();
                importer.navSrs = this.map.getNavigationSrs();
                importer.physSrs = this.map.getPhysicalSrs();
                importer.srs = importer.navSrs;

                importer.loadJSON(this.binPath, {index: 0, root: true}, this.onBinFileLoaded.bind(this));
            } else {
                map.loader.processLoadBinary(this.binPath, this.onBinFileLoaded.bind(this,{index:0}), null, "text", 'direct-3dtiles', {root: true});
            }
            
            return;
        } else if (this.binFiles[0].loadState == 1) {
            return;
        }

        renderer.drawnNodes = 0;

        var mode = this.map.config.mapLoadMode; 

        switch(mode) {
        case 'topdown': this.loadMode = ((this.map.config.mapSplitMeshes && this.map.config.mapSplitSpace) ? 1 : 0); break;
        case 'fit':     this.loadMode = 2; break; 
        case 'fitonly': this.loadMode = 3; break;
        }

        var file = this.binFiles[0];

        this.traverseBinNode(this.rootPoints, this.rootCenter, this.rootRadius, this.rootTexelSize, 0, 0, file, null, null, null);
    }

    if (applyOrigin) {
        var mvp2 = mat4.create();
        var mv2 = mat4.create();
        var pos = this.renderer.position;

        /*
        var transform = this.renderer.layerGroupTransform[this.id];

        if (transform != null) {
            origin = transform[1];
            origin = [origin[0] - pos[0], origin[1] - pos[1], origin[2]];
            mat4.multiply(math.translationMatrix(origin[0], origin[1], origin[2]), transform[0], mv2);
            mat4.multiply(mv, mv2, mv2);
        } else {*/
            var origin = this.origin;
            origin = [origin[0] - pos[0], origin[1] - pos[1], origin[2]];
            mat4.multiply(mv, math.translationMatrix(origin[0], origin[1], origin[2]), mv2);
        /*}*/

        mat4.multiply(mvp, mv2, mvp2);
        mv = mv2;
        mvp = mvp2;
    }

    var cameraPos = renderer.cameraPosition;
    var jobZBuffer = renderer.jobZBuffer;
    var jobZBufferSize = renderer.jobZBufferSize;
    var jobZBuffer2 = renderer.jobZBuffer2;
    var jobZBuffer2Size = renderer.jobZBuffer2Size;

    var onlyHitable = renderer.onlyHitLayers;

    for (var i = 0, li = this.jobs.length; i < li; i++) {
        var job = this.jobs[i];

        if ((job.type == VTS_JOB_ICON || job.type == VTS_JOB_LABEL) && job.visibility > 0) {
            var center = job.center;
            if (vec3.length([center[0]-cameraPos[0],
                center[1]-cameraPos[1],
                center[2]-cameraPos[2]]) > job.visibility) {
                continue;
            }
        }

        if (onlyHitable && !job.hitable) {
            continue;
        }

        job.mv = mv;
        job.mvp = mvp;
        job.renderCounter = renderCounter;
        job.tiltAngle = tiltAngle;
        job.texelSize = texelSize;

        var zIndex = job.zIndex;

        jobZBuffer[zIndex][jobZBufferSize[zIndex]] = job;
        jobZBufferSize[zIndex]++;
    }
};


export default GpuGroup;
