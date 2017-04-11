var express = require('express'),
    app = express(),
    path = require('path'),
    bodyParser = require('body-parser'),
    mongoose = require('mongoose'),
    schedule = require('node-schedule'),
    MMR = require('./server/MMR');

app.use('/vendor', express.static('./bower_components'));
app.use('/assets', express.static('./dist'));
app.use( bodyParser.json() );       
app.use(bodyParser.urlencoded({extended: true})); 
app.set('view engine', 'pug');
app.set('views', './views');

var url = 'mongodb://localhost/aram';
mongoose.connect(url);
mongoose.Promise = global.Promise;

// var rule = new schedule.RecurrenceRule();
// rule.second = 1;
// var f = 0;
// schedule.scheduleJob(rule, function(){
//   console.log('test');
//   if (f == 0) {
//     f = 1;
//     MMR.updateAll(function(players) {
//       console.log('updated all');
//     });
//   }
// });

// everyday at midnight
// schedule.scheduleJob('0 0 * * *', function(){
//   MMR.updateAll(function(players) {
//     console.log('updated all');
//   });
// });

app.get('/', function (req, res) {
  MMR.getRankings(function(players, dates) {
    res.render('index', {
      title: 'ARAM rankings',
      players: players,
      dates: dates
    });
  });
});

// MMR.generateJson();
// MMR.populateFromFile();
// MMR.test();

app.get('/tracked', MMR.getTrackedPlayers);
app.get('/mmr', MMR.getPlayerRankings);

app.post('/update', MMR.updateSinglePlayer);
app.post('/updateall', MMR.updateAllPlayers);

app.listen('4000', function(){
	console.log('listening on 4000');
});
