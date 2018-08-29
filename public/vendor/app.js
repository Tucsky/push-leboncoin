var $row = $('.row-masonry'),
		$average = $('#average'),
		position, token, worker;

function register(newToken) {
	if (!newToken)
		return console.error('Device not ready to receive push notifications yet, please click the "Subscribe" button.');

	$.ajax({
		url: 'register',
		type: 'POST',
		data: {
			token: newToken,
		}
	}).done(function(response) {
		if (!response.success)
			return;

		setAsRegistered(true, newToken);
	})
}

function setAsRegistered(state, newToken) {
	if (state && newToken) {
		token = newToken;
	} else {
		if (token)
			messaging.deleteToken(token);

		token = null;
		state = false;
	}

	$('#registerBlock')[state ? 'slideUp' : 'slideDown'](200);
	$('#registrationBlock')[!state ? 'slideUp' : 'slideDown'](200, function() {
		$row.isotope('layout');
	})
		.find('.token')
		.val(newToken);
}

function subscribe() {
	messaging.requestPermission().then(function() {
		checkSubscription();
	}).catch(function() {
		ohSnap('The permission request was dismissed');
	})
}

function checkSubscription() {
	messaging.getToken().then(register).catch(function() {
		setAsRegistered(false);
		ohSnap('No token found');
	})
}

function unsubscribe() {
	$.ajax({
		url: 'unsubscribe',
		type: 'POST',
		data: {
			token: token,
		}
	}).done(function(response) {
		if (!response.success)
			return;

		setAsRegistered(false);
	})
}

var rad = function(x) {
	return x * Math.PI / 180;
};

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

function get() {
	if ($row.data('loading'))
		return ohSnap('Please wait until the list is done loading !', {color: 'orange'});

	var id = null;

	var $last = $row.find('> .offer:last');

	if ($last.length) {
		var offer = $last.data('offer');

		id = offer.id;
	}

	$row.data('loading', true);

	$.ajax({
		url: 'offers',
		type: 'POST',
		data: {
			id: id,
		}
	}).done(function(response) {
		if (!response.success)
			return;

		if (!response.offers || !response.offers.length) {
			if (id === null)
				return ohSnap('Nothing to display yet', {color: 'red'});
			else {
				return ohSnap('You reached the end of the list', {color: 'red'});
			}
		}

		$average
			.find('span')
			.text(response.avgSqrtPrice.total + '€')
			.parent()
			.slideDown();

		response.offers.reverse();
		response.offers.forEach(function(offer) {
			showOffer(offer);
		})
	}).always(function() {
		$row.data('loading', false);
	})
}

function showOffer(offer, top) {
	var $offer = $('#'+offer.id),
			exists = $offer.length;

	$offer = exists ? $offer : $('<div/>', {id: offer.id, class: 'grid-item offer col-xs-12 col-sm-6 col-md-4'}).html('<div class="card'+(top ? ' card-inverse bg-primary' : '')+'">\
		<div class="card-overlay"></div>\
		'+(offer.images && offer.images.length ? '<a href="#" target="_blank"><img class="card-img-top" src="" alt="'+offer.title+'"></a>' : '')+'\
		<div class="card-block">\
			<h4 class="card-title"><a href="#" target="_blank"></a></h4>\
			<div class="card-text">\
				<p></p>\
			</div>\
			<div class="footer">\
				<small class="offer-ago"></small>\
				<a href="#" target="_blank" class="btn btn-primary" title="Show offer"><i class="fa fa-shopping-cart"></i> <span class="offer-price"></span></a>\
			</div>\
		</div>\
	</div>');

	$offer.data('offer', offer);

	var date = moment(offer.date),
			$metas = $offer.find('.card-overlay');

	$offer.find('.card-title a').text(offer.title);

	$offer.find('.card-text p').html(offer.description.replace(/\n/g, '<br>'));

	$offer.find('.offer-ago').text(date.fromNow())
	$offer.find('.offer-price').text(offer.price+' €');
	$offer.find('a').attr('href', offer.link);

	if (offer.location) {
		var location = offer.location.city_label;

		$metas.append($('<div/>', {class: 'offer-location'}).html(location))

		if (position && offer.location && offer.location.lat && offer.location.lng) {
			var distance = getDistance(position, {
				lat: offer.location.lat,
				lng: offer.location.lng
			});

			location += ' ('+(distance / 1000).toFixed(2)+'km)';

			$metas.append($('<div/>', {class: 'offer-location'}).html((distance / 1000).toFixed(2) + 'km'));
		}
	}

	if (offer.attributes.square) {
		$metas
			.append($('<div/>', {class: 'offer-square'}).html(offer.attributes.square + ' <sup>m²</sup>'))
			.append($('<div/>', {class: 'offer-square-price'}).html((offer.price / offer.attributes.square).toFixed(2) + '€ <sup>/m²</sup>'));
	}

	if (!exists) {
		if (top)
			$row.prepend($offer);
		else
			$row.append($offer);
	}

	if (offer.images && offer.images.length) {
		$offer.find('.card-img-top').one('load error', function() {
			$row
				.isotope('appended', $offer)
				.isotope('layout');
		}).attr('src', 'img/leboncoin/'+offer.images[0]).attr('alt', offer.title);
	} else {
		$row
			.isotope('appended', $offer)
			.isotope('layout');
	}

	if ($offer.find('.card-text p').height() > $offer.find('.card-text').height())
		$offer.find('.card-text').addClass('card-text-overflow');
	else
		$offer.find('.card-text').removeClass('card-text-overflow');
}

navigator.serviceWorker.register('./worker.js')
	.then(function(registration) {
		isWorkerReady(registration);
	}).catch(function(err) {
		console.error(err);
	})

var isWorkerReady = function(registration) {
	if (!registration || !registration.active) {
		console.error('Worker is not ready yet, try again in 1s...');
		return setTimeout(function() {
			isWorkerReady(registration)
		}, 1000);
	}

	worker = registration.active;

	ohSnap('Worker connected', {color: 'green'});
	console.log('Worker is up and running !', worker);

	worker.onstatechange = function(e) {
		console.log('Worker state changed', e);
	}

	worker.onerror = function(e) {
		console.error('Worker error', e);
	}

	messaging.useServiceWorker(registration);

	init();
}

var init = function() {

	/* Register DOM events
	*/

	$(window).scroll(function() {
		if ($(window).scrollTop() + window.innerHeight == $(document).height())
			get();
	});

	$(document).ajaxComplete(function(e, xhr, settings) {
		var response = xhr.responseJSON || {};

		if (response.error)
			ohSnap(response.error, {color: 'red'});
		else {
			switch (xhr.status) {
				case 404:
					ohSnap('The resource "'+settings.url+'" cannot be found', {color: 'red'});
				break;
			}
		}

		if (response.message)
			ohSnap(response.message, {color: 'blue'});
	});

	$('[data-action=subscribe]').on('click', subscribe);
	$('[data-action=unsubscribe]').on('click', unsubscribe);

	$('.row-masonry').isotope({
		itemSelector: '.grid-item',
		layoutMode: 'masonry'
	}).on('click', '.card .card-text-overflow', function() {
		var $item = $(this).toggleClass('more').closest('.grid-item');

		$row.isotope('layout');
	});

	/* Bootstrap worker
	*/

	worker.onmessage = function() {
		console.log('received message');
	};

	messaging.onMessage(function(payload) {
		if (!payload || !payload.data || !payload.data.offer)
			return ohSnap('Invalid payload object received', {color: 'red'});

		try{
			var offer = JSON.parse(payload.data.offer)
		} catch(e) {
			var offer = null;

			ohSnap("Invalid offer received\n"+e.message, {color: 'red'});
		}

		if (offer)
			showOffer(offer, true);
	});

	if (navigator.geolocation)
		navigator.geolocation.getCurrentPosition(function(coordinates) {
			position = {
				lat: coordinates.coords.latitude,
				lng: coordinates.coords.longitude
			};

			worker.postMessage({name: 'position', position: position});

			$row.find('> .offer').each(function() {
				var offer = $(this).data('offer');

				if (!offer.location || !offer.location.lat || !offer.location.lng)
					return;

				var distance = getDistance(position, {
					lat: offer.location.lat,
					lng: offer.location.lng
				});

				$(this).find('.offer-location').append(' (' + (distance / 1000).toFixed(2) + 'km)');
			})
		});
	else
		ohSnap('Geolocation is not supported by this browser', {color: 'red'});

	/* Get device token
	*/

	checkSubscription();

	/* Get first page of offers
	*/

	get();

}