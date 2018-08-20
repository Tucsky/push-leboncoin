if (typeof importScripts === 'function') {
	importScripts('https://www.gstatic.com/firebasejs/4.1.1/firebase-app.js');
	importScripts('https://www.gstatic.com/firebasejs/4.1.1/firebase-messaging.js');
	importScripts('https://www.gstatic.com/firebasejs/4.1.1/firebase.js');
}

var config = {
	apiKey: "AIzaSyAI4aG_wDNXCUww-XCQ-CGgG4V_9a9RGYM",
	authDomain: "tucsky-205309.firebaseapp.com",
	databaseURL: "https://tucsky-205309.firebaseio.com",
	projectId: "tucsky-205309",
	storageBucket: "tucsky-205309.appspot.com",
	messagingSenderId: "811100194361"
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

	self.onnotificationclick = function(e) {
		var notification = e.notification;

		if (!notification)
			return console.error('Notification property is missing the event object');

		switch (e.action) {
			default:
				if (!notification.data || !notification.data.url)
					break;

				var url = notification.data.url;

				e.waitUntil(clients.matchAll({
					type: "window"
				}).then(function(clientList) {
					for (var i = 0; i < clientList.length; i++) {
						var client = clientList[i];
						if (client.url == url && 'focus' in client)
							return client.focus();
					}

					if (clients.openWindow)
						return clients.openWindow(url);
				}));
			break;
		}

		notification.close();
	}

	messaging.setBackgroundMessageHandler(function(payload) {
		var offer, distance = null;

		if (!payload.data || !payload.data.offer)
			return self.registration.showNotification('Invalid payload', {body: 'Payload does not contains any offer property'});

		try {
			offer = JSON.parse(payload.data.offer);
		} catch (e) {};

		if (!offer)
			return self.registration.showNotification('Invalid offer', {body: 'JSON parse failed'});

		if (self.position && offer.location && offer.location.lat && offer.location.lng)
			distance = getDistance(self.position, {
				lat: offer.location.lat,
				lng: offer.location.lng
			});

		return self.registration.showNotification(offer.title, {
			tag: 'offer-'+offer.id,
			body: offer.price + '€' + (offer.location ? ', ' + offer.location.city_label + ' ' + (distance !== null ? ' (' + (distance / 1000).toFixed(2)+'km)' : '') : ''),
			icon: offer.images && offer.images.length ? 'img/leboncoin/'+offer.images[0] : 'img/logo.192.png',
			image: offer.images && offer.images.length ? 'img/leboncoin/'+offer.images[0] : 'img/logo.192.png',
			vibrate: [20, 10, 750],
			actions: [{
				action: 'go',
				title: "Consulter l'annonce",
				icon: 'img/logo.192.png'
			}],
			data: {
				url: offer.link
			}
		});
	});
}