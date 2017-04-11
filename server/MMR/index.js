var fs = require('fs'),
    async = require('async'),
    request = require('request'),
    moment = require('moment'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var regionsMmr = ['na', 'euw', 'eune'];
// var formatstring = "dddd, MMMM Do YYYY, h:mm:ss a";
var formatstring = "DD/MM/YY, h:mm:ss a";
var playerSchema = new Schema({
  name:  String,
  rank: Number,
  lastrank: Number,
  mmr: Number,
  err: Number,
  prevmmr: [{mmr: Number, date: Date}],
  error: String,
  updated: Date
});
var Player = mongoose.model('Player', playerSchema);

var handleError = function(err) {
    console.log('error');
    res.send(err);
}

var getListArray = function() {
    // var list = fs.readFileSync("./test.txt") + '';
    var list = fs.readFileSync("./list.txt") + '';
    return list.split("\n");
}

/**
 * params:  user = {'region': region,'name': name}
 *          (function) cb
 * return:  cb(ret)
 */
var getMMR = function(user, cb) {
    var ret = {
        'ARAM': {
            'avg': null,
            'err': null
        },
        'error': null
    };
    if (!user.name || !user.region || (regionsMmr.indexOf(user.region.toLowerCase()) == -1)) {
        ret.error = 'A name and valid region (na, euw, eune) must be provided';
        return cb(ret);
    }
    // https://region.whatismymmr.com/api/v1/summoner?name=summonername
    var requestUrl = 'https://' + user.region + '.whatismymmr.com/api/v1/summoner?name=' + user.name.replace(/\+/g, '%20');

    request(requestUrl, function(err, res, body) {
        if (err) {
            ret.error = res.statusCode + ': ' + err.message;
        } else {
            const data = JSON.parse(body);
            // {"error":"no MMR data for summoner (001)"}
            if (data.error) {
                ret.error = data.error;
            } else if (!data.ARAM.avg) {
                ret.error = 'no ARAM data for summoner';
            } else {
                ret.ARAM.avg = data.ARAM.avg;
                ret.ARAM.err = data.ARAM.err;
            }
        }
        return cb(ret);
    });
}

var formatDates = function(players, callback) {
    dates = {};
    async.eachLimit(players, 20,
        function(p, cb) {
            dates[p.name] = moment(p.updated).format(formatstring);
            return cb();
        }, function(err) {
            if(err) return handleError(err);
            return callback(dates);
        });
}

var updatePlayer = function(user, cb) {
    Player.findOne({ 'name': user.name }, function (err, player) {
        if (err) return cb(err, null);
        getMMR(user, function(ret) {
            // update existing player
            if (player) {
                // curr: E, last: E
                // curr: E, last: NE
                // curr: NE, last: E
                if (player.mmr != ret.ARAM.avg) {
                    if (player.mmr) {
                        player.prevmmr.push({
                            mmr: player.mmr,
                            date: player.updated
                        });
                    }
                    player.mmr = ret.ARAM.avg;
                    player.err = ret.ARAM.err;
                } else if (player.err != ret.ARAM.err) {
                    player.err = ret.ARAM.err;
                // curr: NE, last: NE, error changes
                } else if (player.error != ret.error) {
                    player.error = ret.error;
                }
                player.updated = new Date()
                player.save(function (err, doc) {
                    if (err) return cb(err, null);
                    return cb(null, doc);
                });
            // create single player
            } else {
                Player.create({
                    name: user.name.toLowerCase(),
                    rank: null,
                    lastrank: null,
                    mmr: ret.ARAM.avg,
                    err: ret.ARAM.err,
                    prevmmr: [],
                    error: ret.error,
                    updated: new Date()
                }, function(err, doc) {
                    if (err) return cb(err, null);
                    return cb(null, doc);
                });
            }
        });
    });
}

var updateRankings = function(callback) {
    Player.find({}).sort({mmr:-1}).exec(function (err, players) {
        if (err) return callback(err, null);
        var prevmmr = 0;
        var rank = 0;
        async.eachOfLimit(players, 20,
            function(p, i, cb) {
                // mmr: E -> NE
                if (!p.mmr) {
                    if (p.rank) {
                        p.rank = null;
                    }
                // mmr: NE -> E
                // mmr: E -> E
                } else {
                    if (prevmmr == p.mmr)  {
                        p.rank = rank;
                    } else {
                        rank += 1;
                        prevmmr = p.mmr;
                        p.rank = rank;
                    }

                }
                p.save(function (err, doc) {
                    if (err) return cb(err);
                    return cb();
                });
            }, function(err) {
                if(err) return callback(err, null);
                return callback(null, players);
            });
    });
}

// exporting

var generateJson = function() {
    var res = [];
    var f = fs.readFileSync("./initial.txt") + '';
    var l, rank, mmr, name;
    f.split("\n").forEach(function(line) {
        l = line.split(/\s+/);
        // rank = l[0];
        mmr = l[1];
        // if (rank == "null") {
        //     rank = null;
        // }
        if (mmr == "null") {
            mmr = null;
        }
        l.splice(0, 2);
        name = l.join(" ").toLowerCase();
        res.push({
          name: name,
          rank: null,
          lastrank: null,
          mmr: mmr,
          err: null,
          prevmmr: [],
          error: null,
          updated: "2017-04-06T04:00:00.000Z"
        });
    });
    var json = JSON.stringify(res, null, 4);
    fs.writeFileSync('initial.json', json, 'utf8');
}

// do this on clean db
var populateFromFile = function (req, res) {
    // var o = JSON.parse(fs.readFileSync('test.json', 'utf8'));
    var o = JSON.parse(fs.readFileSync('initial.json', 'utf8'));
    o.forEach(function(p) {
        Player.create(p, function(err, doc) {
            if (err) return handleError(err);
            console.log(doc);
        });
    });
}

var getRankings = function(cb) {
    Player.find({}).sort({mmr:-1}).exec(function (err, players) {
        if (err) return handleError(err);
        formatDates(players, function(dates){
            return cb(players, dates);
        });
    });
}

var getPlayerRankings = function (req, res) {
    Player.find({}).sort({rank:1}).exec(function (err, players) {
        if (err) return handleError(err);
        res.send(players);
    });
}

var getTrackedPlayers = function (req, res) {
    res.send(getListArray());
}

var updateAll = function(callback) {
    var list = getListArray();
    async.eachLimit(list, 5,
        function(player, cb) {
            console.log('Updating: ' + player);
            var user = {
                region: 'na',
                name: player.toLowerCase()
            };
            updatePlayer(user, function(err, doc) {
                // if (doc) console.log(doc);
                if (err) return cb(err);
                return cb();
            });
        }, function(err) {
            if(err) return handleError(err);
            updateRankings(function(err, players) {
                if(err) return handleError(err);
                console.log('done');
                return callback(players);
            });
        });
}

var updateSinglePlayer = function (req, res) {
    updatePlayer(req.body.user, function(err, doc) {
        if (err) return handleError(err);
        updateRankings(function(err, players) {
            if(err) return handleError(err);
            res.send(doc);
        });
    });
};

var updateAllPlayers = function (req, res) {
    updateAll(function(players) {
        res.send(players);
    });
}

var test = function (req, res) {
    var p = {
        "name": "ice man mic",
        "rank": null,
        "lastrank": null,
        "mmr": "2191",
        "err": null,
        "prevmmr": [],
        "error": null,
        "updated": "2017-04-06T04:00:00.000Z"
    };
    Player.create(p, function(err, doc) {
        console.log(doc);
    });
}

module.exports = {
    test: test,
    generateJson: generateJson,
    populateFromFile: populateFromFile,
    getRankings: getRankings,
    getPlayerRankings: getPlayerRankings,
    getTrackedPlayers: getTrackedPlayers,
    updateAll: updateAll,
    updateSinglePlayer: updateSinglePlayer,
    updateAllPlayers: updateAllPlayers
}