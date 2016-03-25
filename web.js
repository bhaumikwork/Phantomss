


var express = require('express');
var childProcess = require('child_process');
var guid = require('guid');
var AWS = require('aws-sdk');
var fs = require('fs');
var bodyParser = require('body-parser')

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
  res.send('<html><head><title>Screenshots!</title></head><body><h1>Screenshots!</h1><form action="/screenshot" method="POST">URL: <input name="address" value="" placeholder="http://"><br>Size:<input name="size" value="" placeholder="1024px or 1024px*1000px"><br>Zoom factor:<input name="zoom" value="1"><br><input type="hidden" name="redirect" value="true"><input type="submit" value="Get Screenshot!"></form></body></html>');
});

app.post('/screenshot', function(request, response) {
  console.log("request arrived with "+request.body.address);
  if(!request.body.address) {
    return response.status(400).json({ 'error': 'You need to provide the website address.' });
  }

  var filename = guid.raw() + '.png';
  var filenameFull = './images/' + filename;
  var childArgs = [
    __dirname + '/rasterize.js',
    format(request.body.address),
    filenameFull,
    _ServerConfig.size,
    _ServerConfig.zoom
  ];

  //grap the screen
  childProcess.execFile('phantomjs', childArgs, function(error, stdout, stderr){
    console.log("Grabbing screen for: " + request.body.address);
    if(error !== null) {
      console.log("Error capturing page: " + error.message + "\n for address: " + childArgs[1]);
      return response.status(500).json({ 'error': 'Problem capturing page.' });
    } else {
      console.log(stdout,stderr);
      //load the saved file
      fs.readFile(filenameFull, function(err, temp_png_data){
        if(err!=null){
          console.log("Error loading saved screenshot: " + err.message);
          return response.status(500).json({ 'error': 'Problem loading saved page.' });
        }else{
          upload_params = {
            Body: temp_png_data,
            Key: guid.raw() + ".png",
            Bucket: _ServerConfig.bucket,
            ACL: "public-read"
          };
          
          s3bucket.upload(upload_params, function(err, data) {
            if (err) {
              console.log("Error uploading data: ", err);
            } else {
              fs.unlink(filenameFull, function(err){}); //delete local file
              var s3Region = _ServerConfig.region ? 's3-' + _ServerConfig.region : 's3'
              var s3Url = 'https://s3.amazonaws.com/' + _ServerConfig.bucket +
              '/' + upload_params.Key;

              return response.json({ 'url': s3Url });
            }
          });
          
        }
      });
    }
  });
});


var port = 4000; //process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});

function format(url){
  if( url.indexOf("http") > -1 )
    return url;
  else
    return "http://" + url;
}
