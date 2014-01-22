var crio = require("cheerio"),
    expr = require("express"),
    gmag = require("gm"),
    http = require("http"),
    url = require("url"),
    favimg = expr();

// gmag = gmag.subClass({ imageMagick: true });

function download(url, callback) {
    console.log("GET " + url);
    http.get(url, function (res) {
        var data = "";
        res.on("data", function (chunk) {
            data += chunk;
        });
        res.on("end", function () {
            callback(data);
        });
    }).on("error", function () {
        callback(null);
    });
}

function future(value, callback) {
    this.callback = callback;
    this.target = value;
    this.current = undefined;

    this.get = function () {
        return this.current;
    };

    this.set = function (value) {
        this.current = value;
        if (this.target === value) {
            callback();
        }
    };

    this.setTarget = function (new_target) {
        this.target = new_target;
    };

    return this;
}

favimg.get("/favimg", function (req, res) {
    var img = ["http://dev.appnaut.de/nullcat.jpg", 0];

    if (req.query.url !== undefined) {
        var u = url.parse(req.query.url);

        // Download given webpage...
        download(req.query.url, function (data) {
            // ...create DOM of webpage
            var $ = crio.load(data),
                imgs = [];

            // ...seek every image
            $("img").each(function (idx, el) {
                var src = $(el).attr("src");
                // Check if it is a relative URL
                if (src.indexOf("http://") != 0) {
                    if (src.indexOf("/") == 0) {
                        // Starts with root, e.g. /img/foo.jpg
                        src = u.protocol + "//" + u.hostname + src;
                    } else {
                        // src is something like img/foo.jpg
                        src = req.query.url + src;
                    } // TODO: handle ../img/foo.jpg
                }
                imgs.push(src);
            });

            console.log("Found " + imgs.length + " possible images");
            var num_requests = future(imgs.length, function () {
                res.writeHead(301, {
                    "Location": img[0]
                });
                res.end();
            });
            num_requests.set(0);

            $(imgs).each(function (idx, src) {
                // Send request for every image to determine size
                console.log("GET [" + idx + "] " + src);
                http.get(src,
                    function (res) {
                        var g = gmag(res);
                        g.size(function (err, size) {
                            if (err) {
                                console.log("Could not process " + src);
                            } else {
                                var area = size.width * size.height;
                                if (img[1] < area) {
                                    img = [src, area];
                                }
                            }

                            num_requests.set(num_requests.get() + 1);
                        });
                    });
            });
        });
    } else {
        res.send("Missing url parameter");
        res.end();
    }
});

favimg.listen(63888);