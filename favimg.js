var DEBUG = true;
var crio = require("cheerio"),
    expr = require("express"),
    gmag = require("gm"),
    http = require("http"),
    url = require("url"),
    favimg = expr(),
    out = function (msg) {};

// gmag = gmag.subClass({ imageMagick: true });

if (DEBUG) {
    require("longjohn");
    out = console.log;
}

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
}

function fullPath(src, url, req) {
    // Check if it is a relative URL
    if (src.indexOf("http://") != 0) {
        if (src.indexOf("/") == 0) {
            // Starts with root, e.g. /img/foo.jpg
            src = url.protocol + "//" + url.hostname + src;
        } else {
            // src is something like img/foo.jpg
            src = req.query.url + src;
        } // TODO: handle ../img/foo.jpg
    }
    return src;
}

favimg.get("/favimg", function (req, res) {
    var img = ["http://dev.appnaut.de/nullcat.jpg", 0, null, "image/jpeg"];

    var timeout_wrapper = function (req) {
        return function () {
            // do some logging, cleaning, etc. depending on req
            out("Request timeout");
            req.abort();
        };
    };

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
                src = fullPath(src, u, req);
                imgs.push(src);
            });

            console.log("Found " + imgs.length + " possible images");
            var num_requests = new future(imgs.length, function () {
                if (img[2] == null) {
                    res.writeHead(301, {
                        "Location": img[0]
                    });
                } else {
                    var buf = new Buffer(img[2]);
                    res.setHeader("Content-Type", img[3]);
                    res.setHeader("Content-Length", buf.length());
                    res.write(buf);
                    out("Sent " + img[2].length);
                }
                res.end();
            });
            num_requests.set(0);

            $(imgs).each(function (idx, img_src) {
                // Send request for every image to determine size
                out("GET [" + idx + "] " + img_src);

                var request = http.get(img_src,
                    function (res) {
                        var data = null; //new Buffer(res.headers["content-length"]);
                        res.on("data", function (chunk) {
                            //data.write(chunk, data.length());
                            // reset timeout
                            clearTimeout(timeout);
                            timeout = setTimeout(fn, 5000);
                        }).on("end", function () {
                            // clear timeout
                            clearTimeout(timeout);
                        }).on("error", function (err) {
                            // clear timeout
                            clearTimeout(timeout);
                            out("Got error: " + err.message);
                        });

                        var gm = gmag(res);
                        gm.size(function (err, size) {
                            if (err) {
                                out("Could not process " + img_src);
                            } else {
                                var area = size.width * size.height;
                                if (img[1] < area) {
                                    img = [img_src, area, null, res.headers["content-type"]];
                                }
                            }

                            num_requests.set(num_requests.get() + 1);
                        });
                    });

                request.on("error", function (err) {
                    out("Connection to " + img_src + " terminated: " + err);
                });
                var fn = timeout_wrapper(request);
                var timeout = setTimeout(fn, 10000);
            });
        });
    } else {
        res.send("Missing url parameter");
        res.end();
    }
});

favimg.listen(63888);