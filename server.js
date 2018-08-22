const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const leboncoin = require('leboncoin-api');
const fs = require('fs');
const request = require('request');
const moment = require('moment');

/* Create config & credential files if they are missing
*/

if (!fs.existsSync('config.json'))
	fs.writeFileSync('config.json', JSON.stringify({
		"query": {
			"limit": 35,
			"offset": 0,
			"filters": {
				"category": {
					"id": "10"
				},
				"enums": {
					"ad_type": ["offer"],
					"furnished": ["1"],
					"real_estate_type": ["2"]
				},
				"location": {
					"area": {
						"lat": 48.8861712,
						"lng": 2.3581992,
						"radius": 10000
					}
				},
				"keywords": {},
				"ranges": {
					"price": {
						"min": 200,
						"max": 850
					}
				}
			}
		},
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

let persistence = {};

try {
	persistence = JSON.parse(fs.readFileSync('persistence.json'));
} catch (error) {}

var config = require('./config.json') || {},
	tokens = persistence.tokens || [],
	offers = persistence.offers || [],
	offers_ids = persistence.offers_ids || [],
	avgSqrtPrice = getAvgSqrtPrice(offers),
	notified = null;

console.log("[tokens] "+tokens.length+" tokens loaded");
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
		return res.json({success: true, message: "Already registered"});
	}

	tokens.push(token);

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

	console.info('[tokens] Unsubscribed');
	return res.json({success: true, message: "Unsubscribed"});
});

app.post('/offers', function (req, res) {
	if (!offers.length)
		return res.json({success: false, error: "Nothing to show"});

	var id = req.body.id;

	if (!id) {
		var items = offers.slice(offers.length - 15, offers.length);
	} else {
		var index = null;

		for (var i=0; i<offers.length; i++) {
			if (id == offers[i].id) {
				index = i;

				break;
			}
		}

		if (index === null)
			return res.json({success: false, error: "The provided id doesn't match with any active offers"});

		var items = offers.slice(Math.max(0, index - 15), index);
	}

	return res.json({success: true, offers: items, avgSqrtPrice: {
		page: getAvgSqrtPrice(items),
		total: avgSqrtPrice
	}});
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
			tokens = [];
		break;
	}
});

/* App related function
*/

var random_str = function() {
	return Math.random().toString(36).substring();
}

var download = function(uri, path, callback){
	if (fs.existsSync(path)) {

		// File already exists
		return typeof callback === 'function' && callback();

	}

	request.head(uri, function(err, res, body) {
		if (err)
			return console.error(err);

		request(uri).pipe(fs.createWriteStream(path)).on('close', function() {
			typeof callback === 'function' && callback();
		});
	});
};

var getOffers = function() {
	return new leboncoin.Search().run(null, config.query).then(data => {
		if (!data.results) {
			console.log('[scraper] No results');

			return false;
		}

		const _offers = data.results.filter(offer => {
			if (offers_ids.indexOf(offer.id) !== -1) {
				return false;
			}

			if (config.whitelist.length && !(offer.title+' '+offer.description).toLowerCase().match(new RegExp(config.whitelist.join('|')))) {
				return false;
			}

			if (config.blacklist.length && (offer.title+' '+offer.description).toLowerCase().match(new RegExp(config.blacklist.join('|')))) {
				return false;
			}

			return true;
		});

		if (_offers.length) {
			_offers.forEach(offer => {
				console.log('[scraper] Append offer #' + offer.id + ' (' + offer.title + ')');

				offer.date = moment(offer.date);

				offers_ids.push(offer.id);

				if (offer.images && offer.images.length) {
					offer.images.forEach((image, index) => {
						if (index > 0) {
							return;
						}

						offer.images[index] = offer.id + '_' + index + '.jpg';
						download(image, __dirname+'/public/img/leboncoin/' + offer.images[index]);
					})
				}

				offers.push(offer);
			})

			avgSqrtPrice = getAvgSqrtPrice(offers);

			// 10 sec delay before sending the notifications to be sure that the images are up and everythings alright
			setTimeout(sendNotifications, config.countdown);
		}
	}).catch(error => {
		throw new Error(error);
	})
}

var sendNotifications = function(n) {
	offers.sort(function(a, b) {
	    return a.date.diff(b.date);
	});

	if (!tokens.length)
		return console.error('[push] No devices registered');

	// list(offers, 16);

	if (n && n > 0) {
		console.log('[debug] Slice', offers.length - n, offers.length);
		var data = offers.slice(offers.length - n, offers.length);

		if (!data.length)
			return console.error('[push] Nothing to push ('+(offers.length - 1 - n)+' - '+offers.length+')');
	} else {
		if (notified === null)
			notified = offers.length - 1;

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

function updatePersistence() {
	return new Promise((resolve, reject) => {
		fs.writeFile('persistence.json', JSON.stringify({
			tokens: tokens,
			offers_ids: offers_ids,
			offers: offers,
		}), err => {
			if (err) {
				console.error(`[persistence] Failed to write persistence.json\n\t`, err);
				return resolve(false);
			}

			return resolve(true);
		});
	});
}

function getAvgSqrtPrice(offers) {
	const offersWithSquareAttribute = offers
		.filter(offer => offer.attributes.square);

	if (!offersWithSquareAttribute.length) {
		return 0;
	}

	return +(offersWithSquareAttribute.map(offer => offer.price / (offer.attributes.square)).reduce((a, b) => a + b) / offersWithSquareAttribute.length).toFixed(2);
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

process.on('SIGINT', function() {
	console.log('SIGINT');

	Promise.all([updatePersistence()]).then(data => {
		console.log('[server/exit] Goodbye')

		process.exit();
	}).catch(err => {
		console.log(`[server/exit] Something went wrong when executing SIGINT script${err && err.message ? "\n\t" + err.message : ''}`);

		process.exit();
	})
});