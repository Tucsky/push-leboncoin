var express = require('express');
var bodyParser = require('body-parser');
var admin = require('firebase-admin');
var cheerio = require('cheerio');
var fs = require('fs');
var request = require('request');
var moment = require('moment');
var windows1252 = require('windows-1252');

/* Create config & credential files if they are missing
*/

if (!fs.existsSync('config.json'))
	fs.writeFileSync('config.json', JSON.stringify({
		"url": "https://www.leboncoin.fr/velos/offres/ile_de_france/?th=1&w=4&latitude=48.868630&longitude=2.201012&radius=10000&ps=5&pe=12",
		"port": 1337,
		"whitelist": [],
		"blacklist": [],
		"interval": 1000*60*3,
		"countdown": 1000*10,
		"timetolive": 60*60*3,
	}), {flag: 'wx'});

if (!fs.existsSync('tokens.json'))
	fs.writeFileSync('tokens.json', '[]', {flag: 'wx'});

if (!fs.existsSync('credentials.json')) {
	fs.writeFileSync('credentials.json', JSON.stringify({
		"type": '',
		"project_id": '',
		"private_key_id": '',
		"private_key": '',
		"client_email": '',
		"client_id": '',
		"auth_uri": '',
		"token_uri": '',
		"auth_provider_x509_cert_url": '',
		"client_x509_cert_url": ''
	}), {flag: 'wx'});
	console.log("[critical] You need to add your own Firebase service account key file (see README.md #requirements)\n\n"
	+"MORE INFO:\nhttps://console.firebase.google.com/u/0/project/*YOUR PROJECT*/settings/serviceaccounts/adminsdk");
	process.exit();
}

/* Storage
*/

var tokens = require('./tokens.json') || [],
	config = require('./config.json') || {},
	offers = [],
	offers_ids = [];
	notified = null;

config = Object.assign({
	url: 'https://www.leboncoin.fr/velos/offres/ile_de_france/?th=1&w=4&latitude=48.868630&longitude=2.201012&radius=10000&ps=5&pe=12',
	blacklist: [],
	whitelist: []
}, config);

console.log("[tokens] "+tokens.length+" tokens loaded");
console.log('[url] Using "'+config.url+'"');
console.log("[keywords]\n\t- Whitelist: "+config.whitelist.join(', ')+"\n\t- Blacklist: "+config.blacklist.join(', '));
console.log("\n");

/* Core (Express + Firebase Admin)
*/

admin.initializeApp({
	credential: admin.credential.cert(require('./credentials.json')),
});

var app = express();
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({
		extended: true
	}));

app.use(express.static('public'));

/* Routes
*/

app.post('/register', function (req, res) {
	var token = req.body.token;

	if (!token) {
		console.error('[tokens] Invalid token');
		return res.json({success: false, error: "Invalid token"});
	}

	if (tokens.indexOf(token) > -1) {
		console.error('[tokens] Already registered');
		return res.json({success: true, message: "Already registered"});
	}

	tokens.push(token);

	save();

	console.info('[tokens] Registered');
	return res.json({success: true, message: "Registered"});
});

app.post('/unsubscribe', function (req, res) {
	var token = req.body.token;

	if (!token) {
		console.error('[tokens] Invalid token');
		return res.json({success: false, error: "Invalid token"});
	}

	var index = tokens.indexOf(token);

	if (index === -1) {
		console.error('[tokens] Not registered');
		return res.json({success: true, message: "Not registered"});
	}

	tokens.splice(index, 1);

	save();

	console.info('[tokens] Unsubscribed');
	return res.json({success: true, message: "Unsubscribed"});
});

app.post('/offers', function (req, res) {
	if (!offers.length)
		return res.json({success: false, error: "Nothing to show"});

	var id = req.body.id;

	if (!id) {
		console.log('[debug] Slice', offers.length - 15, offers.length);
		var items = offers.slice(offers.length - 15, offers.length);
	}
	else {
		var index = null;

		console.log('[debug] Looking for id "'+id+'"');
		for (var i=0; i<offers.length; i++) {
			console.log('[debug] Offer id comparison', id == offers[i].id ? 'found' : 'nope');
			if (id == offers[i].id) {
				index = i;
				console.log('[debug] Index is', i, offers[i].id, offers[i].title);
				break;
			}
		}

		if (index === null)
			return res.json({success: false, error: "The provided id doesn't match with any active offers"});

		console.log('[debug] Slice', Math.max(0, index - 15), index);
		var items = offers.slice(Math.max(0, index - 15), index);
	}
		
	return res.json({success: true, offers: items});
})

app.get('/', function (req, res) {
	return res.sendFile(__dirname+'/public/app.html');
})

/* Startup
*/

app.listen(config.port, function () {
	console.log("\nlistening on port "+config.port+"\n");
});

/* Listen to CLI inputs
*/

process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', function(text) {
	var path = text.trim().split(' ');

	if (!path || !path.length)
		return console.log("Invalid command\n");

	var fn = path.splice(0, 1).toString();

	switch (fn) {
		case 'push':
			var n = parseInt(path[0]) || 0;

			sendNotifications(n);
		break;
		case 'get':
			getOffers();
		break;
		case 'list':
			list(offers);
		break;
		case 'flush':
			console.log('[tokens] Flush tokens');
			save([]);
		break;
	}
});

/* App related function
*/

var random_str = function() {
	return Math.random().toString(36).substring();
}

var save = function(newTokens) {
	if (typeof newTokens !== 'undefined')
		if (typeof newTokens === 'string' && tokens.indexOf(newTokens) === -1)
			tokens.push(newTokens);
		else
			tokens = newTokens;

	fs.writeFile('tokens.json', JSON.stringify(tokens), 'utf8', function() {
		console.log('[tokens] '+tokens.length+' token'+(tokens.length > 1 ? 's' : '')+' in memory');
	});
}

var download = function(uri, path, callback){
	if (fs.existsSync(path)) {

		// File already exists
		return callback();

	}

	request.head(uri, function(err, res, body) {
		if (err)
			return console.error(err);

		request(uri).pipe(fs.createWriteStream(path)).on('close', function() {
			
			console.log('[image] Downloaded "'+uri+'"');
			callback();

		});
	});
};

var scrape = function(uri, callback, headers) {
	var headers = Object.assign({
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
	}, headers || {})

	setTimeout(function() {
		request({
			url: uri,
			headers: headers,
			encoding: null,
		}, function(err, res, body) { 
			if (err) {
				console.error('[scraper] Request "'+uri+'" failed miserably');
				return callback(false); 
			}

			body = windows1252.decode(body.toString('binary'));

			callback(body); 
		});
	}, Math.random() * 500);
};

var getOffers = function(callback) {
	var url = config.url;

	console.log('[scraper] Initiate request GET');

	scrape(url, function(body) {
		if (body === false)
			return;

		var $ = cheerio.load(body);
		var items = $('.tabsContent a.list_item:first-child');

		//console.log('[scraper] '+items.length+' offer'+(items.length > 1 ? 's' : '')+' in the page');

		items.each(function(index) {

			// Parse id (from list)
			var id = $(this).find('.saveAd').data('savead-id');

			// Parse date (from list)
			var $date = $(this).find('.item_absolute .item_supp'),
				date = $date.text().trim().split(','),
				date = moment($date.attr('content')+(date.length == 2 ? ' '+date[1].trim() : ''));

			var offer = {
				id: id,
				date: date,
				images: [],
				latlng: null,
			};

			// Only scrap offer once
			if (offers_ids.indexOf(offer.id) !== -1) {
				return; //console.log('[scraper] Offer#'+id+' already scraped');
			}
			
			// Register offer (id only, saving the whole object later)
			offers_ids.push(offer.id);

			parseOffer.apply(this, [offer]);
		});
	})

	// 10 sec delay before sending the notifications to be sure that the images are up and everythings alright
	setTimeout(sendNotifications, config.countdown);

};

var parseOffer = function(offer) {
	var url = 'https://www.leboncoin.fr/velos/';

	scrape(url+offer.id+'.htm', function(body) {
		if (body === false)
			return;

		var $ = cheerio.load(body);

		var parse = {
			key: null,
			lat: null,
			lng: null,
		};

		var elements = {
			title: $('title'),
			address: $('.line_city .value'),
			title: $('h1'),
			description: $('.properties_description .value'),
			price: $('.item_price'),
			script1: $('#adview aside.sidebar script'),
		}

		if (elements.title.length) {
			var title = elements.title.text().trim();

			switch (title) {
				case '':
				case 'Annonce introuvable':
				case 'Cette annonce est désactivée':
					console.error('[scraper] Invalid body #'+offer.id+' ('+title+') retry in 1s...');
					return setTimeout(function() {
						parseOffer(offer);
					}, 1000);
				break;
			}
		}

		var valid = true;
		Object.keys(elements).forEach(function(key) {
			if (!elements[key].length) {
				console.error('[scraper] Element "'+key+'" not found in offer #'+offer.id);
				valid = false;
			}
		});

		if (!valid) {
			console.error('[scraper] Skipping offer #'+offer.id+' (missing element(s))');
			return;
		}

		offer.address = elements.address.text().trim();
		offer.title = elements.title.text().trim();
		offer.description = elements.description.html().trim();
		offer.price = elements.price.attr('content');

		var matchWhitelist,
			matchBlacklist;

		if (config.whitelist.length) {
			matchWhitelist = (offer.title+' '+offer.description).toLowerCase().match(new RegExp(config.whitelist.join('|')));

			if (!matchWhitelist)
				return console.info('[scraper] Exclude offer #'+offer.id+' (not whitelisted)');
		}

		if (config.blacklist.length) {
			matchBlacklist = (offer.title+' '+offer.description).toLowerCase().match(new RegExp(config.blacklist.join('|')));

			if (matchBlacklist)
				return console.info('[scraper] Exclude offer #'+offer.id+' (blacklisted'+(matchBlacklist.length ? ' through "'+matchBlacklist[0]+'"' : '')+'))');
		}

		console.log('[scraper] Append offer #'+offer.id);
		offer = offers[offers.push(offer) - 1];

		var latlng = {};

		['lat', 'lng'].forEach(function(key) {
			var match = elements.script1.html().trim().match(new RegExp(key+' = \"(.*)\";'));

			if (match && match[1] && match[1].length > 2 && match[1].length < 32) {
				value = match[1].trim();
				latlng[key] = value;
			} else {
				return console.error('[parser/latlng] No '+key+' found');
			}
		});

		if (latlng.lat && latlng.lng)
			offer.latlng = latlng;

		var imagePath = __dirname+'/public/img/leboncoin/';

		if ($('.item_photo').length) {
			var $script = $('.item_photo').next('script');

			if ($script.length) {
				for (var i=0; i<10; i++) {
					var match = $script.html().trim().match(new RegExp('images\\['+i+'\\] = "(.*)";'));

					if (match && match.length == 2 && match[1].trim().length) {
						var url = 'http:'+match[1].trim(),
							filename = offer.id+'_'+i+'.jpg';

						download(url, imagePath+filename, function() {
							offer.images.push(filename);
						});
					}
				}
			} else {
				console.log('[scraper] Missing script (critical)');
				console.log($.html());
			}
		} else {

			// 0 additional pictures detected

			$cover = $('meta[property="og:image"]');

			if ($cover.length) {

				// Getting cover picture instead

				var url = 'http:'+$cover.attr('content').trim(),
					filename = offer.id+'_0.jpg';

				download(url, imagePath+filename, function() {
					offer.images.push(filename);
				});
			} else
				console.error('[image] Unable to parse cover picture url');
		}
	})
};

var sendNotifications = function(n) {
	offers.sort(function(a, b) { 
	    return a.date.diff(b.date);
	});

	if (!tokens.length)
		return console.error('[push] No devices registered');

	list(offers, 16);

	if (n && n > 0) {
		console.log('[debug] Slice', offers.length - n, offers.length);
		var data = offers.slice(offers.length - n, offers.length);

		if (!data.length)
			return console.error('[push] Nothing to push ('+(offers.length - 1 - n)+' - '+offers.length+')');
	} else {
		if (notified === null)
			notified = offers.length - 1;

		console.log('[debug] Slice', notified, offers.length);
		var data = offers.slice(notified, offers.length);

		if (!data.length)
			return console.error('[push] Nothing new to push');

		notified += data.length;
	}

	list(data, null, "About to send "+data.length+" offers");

	data.forEach(function(offer, indexMessage) {
		admin.messaging().sendToDevice(tokens, {
			data: {
				offer: JSON.stringify(offer)
			},
		}, {
			timeToLive: config.timetolive || 60 * 60 * 3,
		}).then(function(response) {
			var devices = 0;

			response.results.forEach(function(result, indexDevice) {
				if (result.error) {
					var code = result.error.errorInfo.code;

					console.error("\n[push] ERROR while sending push "+(indexMessage + 1)+"/"+data.length+" to device "+(indexDevice + 1)+"/"+tokens.length+"\n", "\t => \""+code+"\"\n");

					switch (code) {
						case 'messaging/registration-token-not-registered':
							console.log('[tokens] Unsubscribing token');
							tokens.splice(indexDevice, 1);
							save();
						break;
					}

					return;
				}
				
				devices++;
			});

			console.log('[push] 1 push (offer #'+offer.title+') sent to '+devices+' device'+(devices > 1 ? 's' : ''));
		}).catch(function(error) {
			console.log('[push] ERROR', error);
		});
	})
}

var list = function(data, n, title) {
	if (!data)
		return;

	var n = parseInt(n);

	if (!title)
		title = n ? "last "+Math.min(n, data.length)+" offers (out of "+data.length+")" : data.length+" offers";

	console.log("\n[list] "+title+" :");
	data.slice(n ? Math.max(0, data.length - n) : 0, data.length).forEach(function(offer) {
		console.log("\t["+offer.id+"] "+offer.title+" ("+offer.price+", "+offer.date.format('YYYY-MM-DD HH:mm:ss')+")");
	});
	console.log("\n");
}

getOffers();

// Delay in ms before getting new results
setInterval(getOffers, config.interval);