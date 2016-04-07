


var express = require('express');
var childProcess = require('child_process');
var guid = require('guid');
var AWS = require('aws-sdk');
var fs = require('fs');
var bodyParser = require('body-parser');
var url = require('url');
var resHash = {}
var _ServerConfig = require('./config.json');

// AWS.config.region = _ServerConfig.region;
// AWS.config.accessKeyId = _ServerConfig.accessKey;
// AWS.config.secretAccessKey = _ServerConfig.secret;


var s3bucket = new AWS.S3({
  accessKeyId: _ServerConfig.accessKey,
  secretAccessKey: _ServerConfig.secret,
});

var app = express();

app.use(bodyParser.json());

app.get('/', function(req, res){
  var url_parts = url.parse(req.url, true);
  var params = url_parts.query;
  var pageContent = fs.readFileSync('./map.html').toString()  ;
  res.end(pageContent.replace("###START###",params.start).replace("###END###",params.end));
});

app.post('/screenshot', function(request, response) {
  console.log("taking ss");
  var address = _ServerConfig.host + "?start=" + request.body.start + "&end=" + request.body.end;
  var filename = guid.raw() + '.png';
  var filenameFull = './images/' + filename;
  var childArgs = [
    __dirname + '/rasterize.js',
    format(address),
    filenameFull,
    _ServerConfig.size,
    _ServerConfig.zoom
  ];

  //grap the screen
  childProcess.execFile('phantomjs', childArgs, function(error, stdout, stderr){
      console.log("Grabbing screen for: " + address);
      resHash['1'] = "Grabbing screen for: " + address;
    setTimeout(function(){
      if(error !== null) {
        resHash['2'] = "Error capturing page: " + error.message + "\n for address: " + childArgs[1];
        console.log("Error capturing page: " + error.message + "\n for address: " + childArgs[1]);
        return response.status(500).json(resHash);
      } else {
        resHash['2'] = "Screen grabbed and load the saved file";
        console.log(stdout,stderr);
        //load the saved file
        fs.readFile(filenameFull, function(err, temp_png_data){
          if(err!=null){
            resHash['3'] = "Error loading saved screenshot: " + err.message;
            console.log("Error loading saved screenshot: " + err.message);
            return response.status(500).json(resHash);
          }else{
            resHash['3'] = "Uploading image on s3.";
            upload_params = {
              Body: temp_png_data,
              Key: guid.raw() + ".png",
              Bucket: _ServerConfig.bucket,
              ACL: "public-read"
            };
            
            s3bucket.upload(upload_params, function(err, data) {
              if (err) {
                resHash['4'] = "Error uploading data: "+ err.message;
                console.log("Error uploading data: ", err);
              } else {
                resHash['4'] = "Image uploaded,deleting from local and returning image-url";
                fs.unlink(filenameFull, function(err){}); //delete local file
                var s3Region = _ServerConfig.region ? 's3-' + _ServerConfig.region : 's3'
                var s3Url = 'https://s3.amazonaws.com/' + _ServerConfig.bucket +
                '/' + upload_params.Key;
                resHash['url'] = s3Url;
                return response.json(resHash);
              }
            });
            
          }
        });
      }
    },2000);
  });
});


var port = process.env.PORT || 4000;
app.listen(port, function() {
  console.log("Listening on " + port);
});

function format(url){
  if( url.indexOf("http") > -1 )
    return url;
  else
    return "http://" + url;
}
