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
	fs.writeFileSync('tokens.json', JSON.stringify({
		"filters": "https://www.leboncoin.fr/velos/offres/ile_de_france/?th=1&w=4&latitude=48.868630&longitude=2.201012&radius=10000&ps=5&pe=12",
		"port": 1337,
		"whitelist": [],
		"blacklist": [],
		"interval": 1000*60*3,
		"countdown": 1000*10,
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
		console.error('[/register] Invalid token');
		return res.json({success: false, error: "Invalid token"});
	}

	if (tokens.indexOf(token) > -1) {
		console.error('[/register] Already registered');
		return res.json({success: true, message: "Already registered"});
	}

	tokens.push(token);

	save();

	console.info('[/register] Registered');
	return res.json({success: true, message: "Registered"});
});

app.post('/unsubscribe', function (req, res) {
	var token = req.body.token;

	if (!token) {
		console.error('[/unsubscribe] Invalid token');
		return res.json({success: false, error: "Invalid token"});
	}

	var index = tokens.indexOf(token);

	if (index === -1) {
		console.error('[/unsubscribe] Not registered');
		return res.json({success: true, message: "Not registered"});
	}

	tokens.splice(index, 1);

	save();

	console.info('[/unsubscribe] Unsubscribed');
	return res.json({success: true, message: "Unsubscribed"});
});

app.post('/offers', function (req, res) {
	var page = req.body.page || 0,
		offset = page * 15;
		items = offers.slice(offset, offset + 15);
		
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
	switch (text.trim()) {
		case 'send':
			send();
		break;
		case 'scrape':
			getOffers();
		break;
	}
});

/* App related function
*/

var save = function() {
	fs.writeFile('tokens.json', JSON.stringify(tokens), 'utf8', function() {
		console.log('[tokens] '+tokens.length+' token(s) saved');
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
};

var getOffers = function(callback) {
	var url = config.url;

	console.log('[scraper] Initiate request GET');
	var count = 0;

	var done = function(callback) {
		var added = offers.length - beforeCount;
		console.log('[scraper] '+added+' offer'+(added > 1 ? 's' : '')+' added');

		if (typeof callback === 'function')
			callback(offers, added);
	}

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

			count++;
		});
	})

	// 10 sec delay before sending the notifications to be sure that the images are up and everythings alright
	setTimeout(sendNotifications, config.countdown);

	// Delay in ms before getting new results
	setTimeout(getOffers, config.interval);

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

		offer.address = $('.line_city .value').text().trim();
		offer.title = $('h1').text().trim();
		offer.description = $('.properties_description .value').html().trim();
		offer.price = $('.item_price').attr('content');

		if (config.whitelist.length && !new RegExp(config.whitelist.join('|')).test((offer.title+' '+offer.description).toLowerCase()))
			return console.info('[scraper] Exclude offer #'+offer.id+' (not whitelisted)');

		if (config.blacklist.length && new RegExp(config.blacklist.join('|')).test((offer.title+' '+offer.description).toLowerCase()))
			return console.info('[scraper] Exclude offer #'+offer.id+' (blacklisted)');

		offer = offers[offers.push(offer) - 1];

		var $script = $('#adview aside.sidebar script'),
			latlng = {};

		if ($script.length) {
			['lat', 'lng'].forEach(function(key) {
				var match = $script.html().trim().match(new RegExp(key+' = \"(.*)\";'));

				if (match && match[1] && match[1].length > 2 && match[1].length < 32) {
					value = match[1].trim();
					latlng[key] = value;
				} else {
					return console.error('[parser/latlng] No '+key+' found');
				}
			});
		} else {
			console.log('[scraper] Missing script (critical)');
			console.log($.html());
		}

		if (latlng.lat && latlng.lng)
			offer.latlng = latlng;

		var imagePath = __dirname+'/public/img/leboncoin/';

		if ($('.item_photo').length) {
			var $script = $('.item_photo').next();

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

var sendNotifications = function(forced) {
	if (!tokens.length)
		return console.error('[push] No devices registered');

	if (notified === null)
		notified = offers.length - 1;

	var data = offers.slice(notified, offers.length);

	if (!data.length)
		return console.error('[push] Nothing new to push');

	data.forEach(function(offer) {
		admin.messaging().sendToDevice(tokens, {
			notification : {
				body: offer.price+'€, '+offer.address,
				title: offer.title,
				icon: offer.images.length ? 'img/leboncoin/'+offer.images[0] : 'img/logo.192.png',
				click_action: 'https://www.leboncoin.fr/1/'+offer.id+'.htm'
			}
		}).then(function(response) {
			console.log('[push] '+data.length+' push'+(data.length > 1 ? 's' : '')+' sent to '+tokens.length+' device'+(tokens.length > 1 ? 's' : ''));
		}).catch(function(error) {
			console.log('[push] ERROR', error);
		});
	})

	notified += data.length;
}

getOffers();