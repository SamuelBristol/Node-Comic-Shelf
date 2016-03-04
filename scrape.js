'use strict';

// Requires
var Request = require('request');
var Cheerio = require('cheerio');
var Events = require('events');
var FileSystem = require('fs');

// Enable events
var myEvents = new Events.EventEmitter();

// Variables
var comics = new Array();
var domain = 'http://www.giantitp.com';

// Generic function to check for file existence
function fileExists(filePath) {
  try {
    FileSystem.openSync(filePath, 'r');
    return true;
  } catch (e) {
    return false;
  }
}

myEvents.on('gotComicMetadata', function(){
  comics.forEach(function(value, index){
    var title = value.title.replace(/([^a-z0-9]+)/gi, "_"); // replace invalid filename characters
    var link = value.link;
    var done = false;
    Request(link, function(error, response, html){
      var $ = Cheerio.load(html);
      var images = $('img');
      var comicImageLink;
      images.each(function(i, element){
        var src = $(element).attr('src');
        if(src.substr(0, 7) == '/comics'){
          comicImageLink = domain + src;
          myEvents.emit('gotComicLink', comicImageLink, title);
        }
      }); // end processing on each image in page
      done = true;
    }); // end request for image
    require('deasync').loopWhile(function(){ return !done; });
  }); // end for each comic
});

myEvents.on('gotComicLink', function(comicImageLink, title) {
  var done = false;
  var filePath = './comics/giantitp/' + title + '.jpg';

  if (fileExists(filePath)) {
    console.log(title + ' was already downloaded. Moving on to the next comic.');
  } else {
    console.log('Downloading ' + title + '...');
    var stream = Request(comicImageLink).pipe(FileSystem.createWriteStream(filePath));
    stream.on('finish', function(){
      done = true;
    });
    require('deasync').loopWhile(function(){ return !done; });

    myEvents.emit('downloadComplete', title);
  }
});

myEvents.on('downloadComplete', function(title){
  console.log('Completed download of ' + title + '.')
});

Request('http://www.giantitp.com/comics/oots.html', function (error, response, html) {
  if (!error && response.statusCode == 200) {
    var $ = Cheerio.load(html);

    var pList = $('p');

    pList.each(function(i, element){
      var title = $(element).text().trim();
      if(title){
        var link = domain + $(element).children('a').attr('href');
        comics.push({
          title: title,
          link: link
        });
      }
    });

    myEvents.emit('gotComicMetadata');
  }
});
