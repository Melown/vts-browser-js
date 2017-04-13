
import MapTexture_ from './texture';
import MapSubtexture_ from './subtexture';
import MapMetatile_ from './metatile';
import MapMesh_ from './mesh';
import MapGeodata_ from './geodata';

//get rid of compiler mess
var MapTexture = MapTexture_;
var MapSubtexture = MapSubtexture_;
var MapMetatile = MapMetatile_;
var MapMesh = MapMesh_;
var MapGeodata = MapGeodata_;


var MapResourceNode = function(map, parent, id) {
    this.map = map;
    this.id = id;
    this.parent = parent;

    this.metatiles = {};
    this.meshes = {};
    this.textures = {};
    this.subtextures = {};
    this.geodata = {};
    this.credits = {};

    this.children = [null, null, null, null];
};


MapResourceNode.prototype.kill = function() {
    //kill children
    for (var i = 0; i < 4; i++) {
        if (this.children[i] != null) {
            this.children[i].kill();
        }
    }

    this.children = [null, null, null, null];

    var parent = this.parent;
    this.parent = null;

    if (parent != null) {
        parent.removeChild(this);
    }
    
    //kill resources?
};


MapResourceNode.prototype.addChild = function(index) {
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

    this.children[index] = new MapResourceNode(this.map, this, childId);
};


MapResourceNode.prototype.removeChildByIndex = function(index) {
    if (this.children[index] != null) {
        this.children[index].kill();
        this.children[index] = null;
    }
};


MapResourceNode.prototype.removeChild = function(tile) {
    for (var i = 0; i < 4; i++) {
        if (this.children[i] == tile) {
            this.children[i].kill();
            this.children[i] = null;
        }
    }
};


// Meshes ---------------------------------

MapResourceNode.prototype.getMesh = function(path, tile) {
    var mesh = this.meshes[path];
    
    if (!mesh) {
        mesh = new MapMesh(this.map, path, tile);
        this.meshes[path] = mesh;
    }
    
    return mesh;
};


// Geodata ---------------------------------

MapResourceNode.prototype.getGeodata = function(path, extraInfo) {
    var geodata = this.geodata[path];
    
    if (!geodata) {
        geodata = new MapGeodata(this.map, path, extraInfo);
        this.geodata[path] = geodata;
    }
    
    return geodata;
};


// Textures ---------------------------------

MapResourceNode.prototype.getTexture = function(path, heightMap, extraBound, extraInfo, tile, internal) {
    if (extraInfo && extraInfo.layer) {
        var id = path + extraInfo.layer.id;
        var texture = this.textures[id];
        
        if (!texture) {
            texture = new MapTexture(this.map, path, heightMap, extraBound, extraInfo, tile, internal);
            this.textures[id] = texture;
        }
    } else {
        var texture = this.textures[path];
        
        if (!texture) {
            texture = new MapTexture(this.map, path, heightMap, extraBound, extraInfo, tile, internal);
            this.textures[path] = texture;
        }
    }
    
    return texture;
};


// SubTextures ---------------------------------

MapResourceNode.prototype.getSubtexture = function(texture, path, heightMap, extraBound, extraInfo, tile, internal) {
    var texture = this.subtextures[path];
    
    if (!texture) {
        texture = new MapSubtexture(this.map, path, heightMap, extraBound, extraInfo, tile, internal);
        this.subtextures[path] = texture;
    }
    
    return texture;
};


// Metatiles ---------------------------------

MapResourceNode.prototype.addMetatile = function(path, metatile) {
    this.metatiles[path] = metatile;
};


MapResourceNode.prototype.removeMetatile = function(metatile) {
    for (var key in this.metatiles) {
        if (this.metatiles[key] == metatile) {
            delete this.metatiles[key];
        }
    }
};


MapResourceNode.prototype.getMetatile = function(surface, allowCreation, tile) {
    var metatiles = this.metatiles; 
    for (var key in metatiles) {
        if (metatiles[key].surface == surface) {
            return metatiles[key];
        } 
    }
    
    var path = surface.getMetaUrl(this.id);

    if (metatiles[path]) {
        var metatile = metatiles[path].clone(surface);
        this.addMetatile(path, metatile);
        return metatile;
    }

    if (allowCreation) {
        var metatile = new MapMetatile(this, surface, tile);
        this.addMetatile(path, metatile);
        return metatile; 
    } else {
        return null;
    }
};


export default MapResourceNode;


