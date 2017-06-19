if (typeof importScripts === 'function') {
	importScripts('https://www.gstatic.com/firebasejs/4.1.1/firebase-app.js');
	importScripts('https://www.gstatic.com/firebasejs/4.1.1/firebase-messaging.js');
	importScripts('https://www.gstatic.com/firebasejs/4.1.1/firebase.js');
}

var config = {
	apiKey: "AIzaSyCRSoBL6dKwZ-jlp22oXagCRVIKFOQBsvs",
	authDomain: "project-2792471436428079009.firebaseapp.com",
	databaseURL: "https://project-2792471436428079009.firebaseio.com",
	projectId: "project-2792471436428079009",
	storageBucket: "project-2792471436428079009.appspot.com",
	messagingSenderId: "855601272318"
};

firebase.initializeApp(config);

var messaging = firebase.messaging();

if (typeof importScripts === 'function') {
	self.position;

	var getDistance = function(p1, p2) {
		var R = 6378137;
		var dLat = rad(p2.lat - p1.lat);
		var dLong = rad(p2.lng - p1.lng);
		var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(rad(p1.lat)) * Math.cos(rad(p2.lat)) *
		Math.sin(dLong / 2) * Math.sin(dLong / 2);
		var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		var d = R * c;
		return d;
	};

	var rad = function(x) {
		return x * Math.PI / 180;
	};

	self.onmessage = function(e) {
		var data = e.data;

		if (!data || !data.name)
			return;

		switch (data.name.toLowerCase()) {
			case 'position':
				self.position = data.position;
			break;
		};
	};

	messaging.setBackgroundMessageHandler(function(payload) {
		var offer, distance = null;

		if (!payload.data || !payload.data.offer)
			return self.registration.showNotification('Invalid payload', {body: 'Payload does not contains any offer property'});

		try {
			offer = JSON.parse(payload.data.offer);
		} catch (e) {};

		if (!offer)
			return self.registration.showNotification('Invalid offer', {body: 'JSON parse failed'});

		if (self.position && offer.latlng)
			distance = getDistance(self.position, offer.latlng);

		return self.registration.showNotification(offer.title, {
			body: offer.price+'€, '+offer.address+(distance !== null ? ' ('+(distance / 1000).toFixed(2)+'km)' : ''),
			icon: offer.images.length ? 'img/leboncoin/'+offer.images[0] : 'img/logo.192.png',
			image: offer.images.length ? 'img/leboncoin/'+offer.images[0] : 'img/logo.192.png',
			click_action: 'https://www.leboncoin.fr/1/'+offer.id+'.htm'
		});
	});
}