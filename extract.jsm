var EXPORTED_SYMBOLS = ["extractor"];
var marker = "--MARK--";

var extractor = {
  locale: "en-US",

  setLocale: function setLocale(locale) {
    this.locale = locale;
  },

  findNow: function findNow(email) {
    var now = {};
    
    // use date header
    var re = /^Date:\s\w{3},\s+(\d{1,2})\s(\w{3})\s(\d{4})\s(\d{2}):(\d{1,2})/m;
    var res = re.exec(email);

    now.day = parseInt(res[1]);
    switch (res[2]) {
      case "Jan":
        now.month = 1;
        break;
      case "Feb":
        now.month = 2;
        break;
      case "Mar":
        now.month = 3;
        break;
      case "Apr":
        now.month = 4;
        break;
      case "May":
        now.month = 5;
        break;
      case "Jun":
        now.month = 6;
        break;
      case "Jul":
        now.month = 7;
        break;
      case "Aug":
        now.month = 8;
        break;
      case "Sep":
        now.month = 9;
        break;
      case "Oct":
        now.month = 10;
        break;
      case "Now":
        now.month = 11;
        break;
      case "Dec":
        now.month = 12;
        break;
    }
    now.year = parseInt(res[3]);
    now.hour = parseInt(res[4]);
  //   hardly correct unless sent exactly at meeting start
  //   now.minute = parseInt(res[5]);
    
    return now;
  },

  extract: function extract(email, now) {
    var service = Components.classes["@mozilla.org/intl/stringbundle;1"]
      .getService(Components.interfaces.nsIStringBundleService);
    var bundle = service.createBundle("file:///media/Meedia/tty/lt/event-extract/extract_" + this.locale + ".properties");
    
    guess = now;
    // remove Date: and Sent: lines
    email = email.replace(/^Date:.+$/m, "");
    email = email.replace(/^Sent:.+$/m, "");
    
    // from less specific to more specific
    
    if (new RegExp(this.getAlternatives(bundle, "tomorrow")).exec(email)) {
      guess.day++;
    }
    
    // day only
    var alts = this.getRepAlternatives(bundle, "ordinal.date", ["(\\d{1,2})"]);
    for (var alt in alts) {
      res = new RegExp(alts[alt].pattern).exec(email);
      if (res) {
        res[1] = parseInt(res[1]);
        guess.day = res[1];
      }
    }
    
    // time only
    alts = this.getRepAlternatives(bundle, "am.hour.only", ["(\\d{1,2})"]);
    for (var alt in alts) {
      res = new RegExp(alts[alt].pattern).exec(email);
      if (res) {
        guess.hour = parseInt(res[1]);
        guess.minute = 0;
      }
    }
      
    alts = this.getRepAlternatives(bundle, "pm.hour.only", ["(\\d{1,2})"]);
    for (var alt in alts) {
      res = new RegExp(alts[alt].pattern).exec(email);
      if (res) {
        guess.hour = parseInt(res[1]) + 12;
        guess.minute = 0;
      }
    }
    
    alts = this.getRepAlternatives(bundle, "duration.full.hours", ["(\\d{1,2})","(\\d{1,2})"]);
    for (var alt in alts) {
      res = new RegExp(alts[alt].pattern).exec(email);
      if (res) {
          res[1] = parseInt(res[1]);
          if (res[1] < 8) {
            guess.hour = res[1] + 12;
          } else {
            guess.hour = res[1];
          }
          guess.minute = 0;
      }
    }
    
    alts = this.getRepAlternatives(bundle, "duration.full.hour.to.minutes", ["(\\d{1,2})","(\\d{1,2})", "(\\d{2})"]);
    for (var alt in alts) {
      res = new RegExp(alts[alt].pattern).exec(email);
      if (res) {
          res[1] = parseInt(res[1]);
          if (res[1] < 8) {
            guess.hour = res[1] + 12;
          } else {
            guess.hour = res[1];
          }
          guess.minute = 0;
      }
    }
    
    alts = this.getRepAlternatives(bundle, "duration.minutes.to.minutes", ["(\\d{1,2})", "(\\d{2})","(\\d{1,2})", "(\\d{2})"]);
    for (var alt in alts) {
      res = new RegExp(alts[alt].pattern).exec(email);
      if (res) {
          res[1] = parseInt(res[1]);
          if (res[1] < 8) {
            guess.hour = res[1] + 12;
          } else {
            guess.hour = res[1];
          }
          guess.minute = parseInt(res[2]);
      }
    }
    
    // hour:minutes
    alts = this.getRepAlternatives(bundle, "hour.minutes", ["(\\d{1,2})","(\\d{2})"]);
    for (var alt in alts) {
      res = new RegExp(alts[alt].pattern).exec(email);
      if (res) {
        res[1] = parseInt(res[1]);
        // unlikely meeting time, XXX should consider working hours
        if (res[1] < 8) {
          guess.hour = res[1] + 12;
        } else {
          guess.hour = res[1];
        }
        res[2] = parseInt(res[2]);
        guess.minute = res[2];
      }
    }

    alts = this.getRepAlternatives(bundle, "hour.minutes.am", ["(\\d{1,2})", "(\\d{2})"]);
    for (var alt in alts) {
      res = new RegExp(alts[alt].pattern).exec(email);
      if (res) {
        guess.hour = parseInt(res[1]);
        guess.minutes = parseInt(res[2]);
      }
    }
    
    alts = this.getRepAlternatives(bundle, "hour.minutes.pm", ["(\\d{1,2})", "(\\d{2})"]);
    for (var alt in alts) {
      res = new RegExp(alts[alt].pattern).exec(email);
      if (res) {
        guess.hour = parseInt(res[1]);
        if (guess.hour < 12) guess.hour += 12;
        guess.minutes = parseInt(res[2]);
      }
    }

    // month with day
    let months = [];
    for (let i = 0; i < 12; i++) {
      months[i] = this.getAlternatives(bundle, "month." + (i + 1));
    }
    // | is both used as pattern separator and within patterns
    // ignore those within patterns temporarily
    let allMonths = months.join(marker).replace("|", marker, "g");
    alts = this.getRepAlternatives(bundle, "month.day", ["(" + allMonths + ")", "(\\d{1,2})"]);
    for (var alt in alts) {
      let re = alts[alt].pattern.replace(marker, "|", "g");
      let positions = alts[alt].positions;

      res = new RegExp(re, "i").exec(email);
      
      if (res) {
        guess.day = parseInt(res[positions[2]]);
        for (let i = 0; i < 12; i++) {
          if (months[i].unescape().split("|").indexOf(res[positions[1]].toLowerCase()) != -1) {
            guess.month = i + 1;
          }
        }
      }
    }
    
    // date with year
    alts = this.getRepAlternatives(bundle, "day.month.year",
                              ["(\\d{1,2})", "(" + allMonths + ")", "(\\d{2,4})" ]);
    for (var alt in alts) {
      let re = alts[alt].pattern.replace(marker, "|", "g");
      let positions = alts[alt].positions;

      res = new RegExp(re, "i").exec(email);
      
      if (res) {
        guess.day = parseInt(res[positions[1]]);
        for (let i = 0; i < 12; i++) {
          if (months[i].split("|").indexOf(res[positions[2]].toLowerCase()) != -1) {
            guess.month = i + 1;
          }
        }
        if (res[positions[3]].length == 2)
          res[positions[3]] = "20" + res[positions[3]];
        guess.year = parseInt(res[positions[3]]);
      }
    }
    
    return guess;
  },

  getAlternatives: function getAlternatives(bundle, name) {
    let value = bundle.GetStringFromName(name);
    value = value.replace(" |", "|", "g").replace("| ", "|", "g");
    return value.sanitize();
  },

  getRepAlternatives: function getRepAlternatives(bundle, name, replaceables) {
    let value = bundle.formatStringFromName(name, replaceables, replaceables.length);
    value = value.replace(" |", "|", "g").replace("| ", "|", "g");
    value = value.sanitize();
    let patterns = value.split("|");
    
    let rawValues = this.getAlternatives(bundle, name).split("|");
    
    let alts = new Array();
    let i = 0;
    for (var pattern in patterns) {
      // XXX only add information when more than 1 replaceables, not needed otherwise
      let positions = this.getPositionsFor(rawValues[i]);
      alts[i] = {pattern: patterns[i], positions: positions};
      i++;
    }
    
    return alts;
  },

  getPositionsFor: function getPositionsFor(s) {
    let positions = new Array();
    let re = /\%(\d)\$S/g;
    let match = true;
    let i = 0;
    while (true) {
      i++;
      match = re.exec(s);
      if (!match)
        break;
      positions[parseInt(match[1])] = i;
    }
    
    return positions;
  }
}

// XXX should replace all special characters for regexp not just .
String.prototype.sanitize = function() {
  let res = this.replace(/([^\\])([\.])/g, "$1\\$2");
  return res;
}

String.prototype.unescape = function() {
  let res = this.replace(/\\([\.])/g, "$1");
  return res;
}
