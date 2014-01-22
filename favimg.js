var crio = require("cheerio"),
    expr = require("express"),
    gmag = require("gm"),
    http = require("http"),
    favimg = expr();

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
    var img = [null, 0];

    if (req.query.url !== undefined) {
        // Download given webpage...
        download(req.query.url, function (data) {
            // ...create DOM of webpage
            var $ = crio.load(data),
                imgs = [];

            // ...seek every image
            $("img").each(function (idx, el) {
                var src = $(el).attr("src");
                if (src.indexOf("http://") == 0 && src.indexOf("https://") == 0) {
                    src = req.query.url + src;
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
                console.log("GET " + src);
                http.get(src,
                    function (res) {
                        var g = gmag(res);
                        g.size(function (err, size) {
                            var area = size.width * size.height;
                            if (img[1] < area) {
                                img = [src, area];
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

favimg.listen(8888);