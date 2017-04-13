
var UIControlCredits = function(ui, visible) {
    this.ui = ui;
    this.browser = ui.browser;
    this.control = this.ui.addControl("credits",
      '<div id="vts-credits"'
      + ' class="vts-credits">'
      + ' </div>', visible);

    this.lastHTML = "";
    this.lastHTML2 = "";
    this.lastHTML3 = "";
    this.credits = this.control.getElement("vts-credits");
};


UIControlCredits.prototype.getCreditsString = function(array, separator, full) {
    var map = this.browser.getMap();
    var html = "";
    var copyright = "&copy;" + (new Date().getFullYear());
    
    var li = array.length;
    var plain = ""; 
    var more = false;

    for (var i = 0; i < li; i++) {
        var creditInfo = map.getCreditInfo(array[i]);
        if (creditInfo["plain"]) {
            plain += creditInfo["plain"];
        }
    }        
    
    if (plain && plain.length > 30 && li > 1 && !full) {
        li = 1;
        more = true; 
    }

    for (var i = 0; i < li; i++) {
        var creditInfo = map.getCreditInfo(array[i]);
       
        if (creditInfo["html"]) {
            html += creditInfo["html"];
        }

        if (i + 1 < li) {
            html += separator;        
        }
    }
    
    return [html, more];
};


UIControlCredits.prototype.update = function() {
    var map = this.browser.getMap();
    if (map == null) {
        return;
    }

    var html = "";
    var html2 = "";
    var html3 = "";
    var credits = map.getCurrentCredits();
    
    if (credits["imagery"].length > 0) {
        var res = this.getCreditsString(credits["imagery"], ", ");
        html += "<div class='vts-credits-supercell'>";
            html += "<div class='vts-credits-cell'>Imagery: " + res[0] + "</div>";
            html += res[1] ? "<div class='vts-credits-cell-button' id='vts-credits-imagery-more'>and others</div>" : "";
            html += "<div class='vts-credits-separator'></div>";
        html += "</div>";
        var html2 = "<div class='vts-credits-list'>";
        html2 += this.getCreditsString(credits["imagery"], "<br/>", true)[0] + "</div>";
    }
    
    if (credits["mapdata"].length > 0) {
        var res = this.getCreditsString(credits["mapdata"], ", ");
        html += "<div class='vts-credits-supercell'>";
            html += "<div class='vts-credits-cell'>Map Data: " + res[0] + "</div>";
            html += res[1] ? "<div class='vts-credits-cell-button' id='vts-credits-mapdata-more'>and others</div>" : "";
            html += "<div class='vts-credits-separator'></div>";
        html += "</div>";
        var html3 = "<div class='vts-credits-list'>";
        html3 += this.getCreditsString(credits["mapdata"], "<br/>", true)[0] + "</div>";
    }

    html += "<div class='vts-credits-supercell'>";
        html += "<div class='vts-credits-cell'>Powered by <a class='vts-logo' href='https://melown.com' target='blank'>MELOWN</a></div>";
        html += "<div class='vts-credits-separator'></div>";
    html += "</div>";

    if (this.lastHTML != html) {
        this.lastHTML = html;
        this.credits.setHtml(html);

        var butt = this.control.getElement("vts-credits-imagery-more");
        if (butt) {
            butt.on("click", this.onMoreButton.bind(this, butt, "2"));
        }
        
        butt = this.control.getElement("vts-credits-mapdata-more");
        if (butt) {
            butt.on("click", this.onMoreButton.bind(this, butt, "3"));
        }
    }

    this.lastHTML2 = html2;
    this.lastHTML3 = html3;

    /*
    if (this.lastHTML2 != html2) {
        var butt = this.control.getElement("vts-credits-imagery-more");
        if (butt) {
            butt.on("click", this.onMoreButton.bind(this, butt, "2"));
        }
    }
        
    if (this.lastHTML3 != html3) {
        var butt = this.control.getElement("vts-credits-mapdata-more");
        if (butt) {
            butt.on("click", this.onMoreButton.bind(this, butt, "3"));
        }
    }*/
};


UIControlCredits.prototype.onMoreButton = function(butt, html) {
    var rect = butt.getRect();
    
    if (html == "2") {
        html = this.lastHTML2;
    } else {
        html = this.lastHTML3;
    }
    
    this.ui.popup.show({"right" : Math.max(0,(rect["fromRight"]-rect["width"])) + "px",
                          "bottom" : (rect["fromBottom"]+7) + "px"}, html);
};


export default UIControlCredits;

