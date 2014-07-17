var path       = require('path');
var fs         = require('fs');
var Witer      = require('broccoli-writer');
var Handlebars = require('handlebars');
var walkSync   = require('walk-sync');
var RSVP       = require('rsvp');
var helpers    = require('broccoli-kitchen-sink-helpers');
var mkdirp     = require('mkdirp');
var Promise    = RSVP.Promise;

var EXTENSIONS_REGEX = new RegExp('.(hbs|handlebars)');

var HandlebarsWiter = function (inputTree, files, options) {
  if (!(this instanceof HandlebarsWiter)) {
    return new HandlebarsWiter(inputTree, files, options);
  }

  this.inputTree = inputTree;
  this.files = files;

  this.options = options || {};
  this.context = this.options.context || {};
  this.handlebars = this.options.handlebars || Handlebars;
  if (this.options.helpers) {
    this.handlebars.registerHelper(options.helpers);
  }
  this.loadPartials();
};

HandlebarsWiter.prototype = Object.create(Witer.prototype);
HandlebarsWiter.prototype.constructor = HandlebarsWiter;

HandlebarsWiter.prototype.loadPartials = function () {
  var partials = this.options.partials;
  var partialsPath;
  var partialsObj;
  var pertialFiles;

  if (partials) {
    if ('string' !== typeof partials) throw Error('options.partials must be a string');

    partialsObj = {};
    partialsPath = path.join(process.cwd(), partials);
    pertialFiles = walkSync(partialsPath).filter(EXTENSIONS_REGEX.test.bind(EXTENSIONS_REGEX));

    pertialFiles.forEach(function (file) {
      var key = file.replace(partialsPath, '').replace(EXTENSIONS_REGEX, '');
      var filePath = path.join(partialsPath, file);
      partialsObj[key] = fs.readFileSync(filePath).toString();
    });
    this.handlebars.registerPartial(partialsObj);
  }
};

HandlebarsWiter.prototype.write = function (readTree, destDir) {
  var self = this;
  this.loadPartials();
  return readTree(this.inputTree).then(function (sourceDir) {
    var targetFiles = helpers.multiGlob(self.files, {cwd: sourceDir});
    return RSVP.all(targetFiles.map(function (targetFile) {
      function write (output) {
        var targetHTMLFile = targetFile.replace(/(hbs|handlebars)$/, 'html');
        var destFilepath = path.join(destDir, targetHTMLFile);
        mkdirp.sync(path.dirname(destFilepath));
        var str = fs.readFileSync(path.join(sourceDir, targetFile)).toString();
        var template = self.handlebars.compile(str);
        fs.writeFileSync(path.join(destDir, targetHTMLFile), template(output));
      }
      if ('function' !== typeof self.context) write(self.context);
      return Promise.resolve(self.context(targetFile)).then(write);
    }));
  });
};

module.exports = HandlebarsWiter;

