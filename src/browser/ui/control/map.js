
var UIControlMap = function(ui, visible) {
    this.ui = ui;
    this.browser = ui.browser;
    this.control = this.ui.addControl("map",
      '<div id="vts-map"'
      + ' class="vts-map">'
      + ' </div>');

    var map = this.getMapElement();
    map.setDraggableState(true);
};


UIControlMap.prototype.getMapElement = function() {
    return this.control.getElement("vts-map");
};


export default UIControlMap;
