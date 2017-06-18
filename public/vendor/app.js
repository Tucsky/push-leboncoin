var $row = $('.row-masonry'),
	position, token;

function register(newToken) {
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
		$row.masonry('layout');
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

	$row.data('loading', true);

	var page = $row.data('page', typeof $row.data('page') !== 'undefined' ? $row.data('page') + 1 : 0).data('page');

	$.ajax({
		url: 'offers',
		type: 'POST',
		data: {
			page: page,
		}
	}).done(function(response) {
		if (!response.success)
			return;

		if (!response.offers || !response.offers.length) {
			if (page == 0)
				return ohSnap('Nothing to display yet', {color: 'red'});
			else {
				$row.data('page', page - 1);
				return ohSnap('You reached the end of the list', {color: 'red'});
			}
		}

		response.offers.forEach(function(offer) {
			var $offer = $('#'+offer.id),
				exists = $offer.length;

			$offer = exists ? $offer : $('<div/>', {id: offer.id, class: 'grid-item offer col-xs-12 col-sm-6 col-md-4'}).html('<div class="card">\
				'+(offer.images.length ? '<img class="card-img-top" src="" alt="'+offer.title+'">' : '')+'\
				<div class="card-block">\
					<h4 class="card-title"></h4>\
					<p class="card-text"></p>\
					<div class="footer">\
						<small class="text-muted">\
							<span class="offer-ago"></span>\
							<span class="offer-distance"></span>\
						</small>\
						<a href="#" target="_blank" class="btn btn-primary" title="Show offer">Show</a>\
					</div>\
				</div>\
			</div>');

			$offer.data('offer', offer);

			var date = moment(offer.date);

			$offer.find('.card-title').text(offer.title);
			$offer.find('.card-text').html(offer.description);
			$offer.find('.offer-ago').text(date.fromNow());
			$offer.find('a')
				.attr('href', 'https://www.leboncoin.fr/velos/'+offer.id+'.htm')
				.text(offer.price+' €');

			if (position && offer.latlng) {
				var distance = getDistance(position, offer.latlng);
				$offer.find('.offer-distance').text('('+(distance / 1000).toFixed(2)+'km)');
			}

			if (offer.images.length) {
				$offer.find('.card-img-top').one('load', function() {
					$row.masonry('appended', $offer);
				}).attr('src', 'img/leboncoin/'+offer.images[0]).attr('alt', offer.title);
			}

			if (!exists)
				$row.append($offer);
		})
	}).always(function() {
		$row.data('loading', false);
	})
}

$(document).ready(function() {
	$('[data-action=subscribe]').on('click', subscribe);
	$('[data-action=unsubscribe]').on('click', unsubscribe);

	$('.row-masonry').masonry({
		columnWidth: '.grid-sizer',
		itemSelector: '.grid-item',
		percentPosition: true
	});

	$(window).scroll(function() {
		if ($(window).scrollTop() + $(window).height() == $(document).height()) {
			get()
		}
	});    

	if (navigator.geolocation)
		navigator.geolocation.getCurrentPosition(function(coordinates) {
			position = {
				lat: coordinates.coords.latitude,
				lng: coordinates.coords.longitude
			};

			$row.find('> .offer').each(function() {
				var offer = $(this).data('offer');

				if (!offer.latlng)
					return;

				var distance = getDistance(position, offer.latlng);

				$(this).find('.offer-distance').text('('+(distance / 1000).toFixed(2)+'km)');
			})
		});
	else
		ohSnap('Geolocation is not supported by this browser', {color: 'red'});

	checkSubscription();

	get();
}).ajaxComplete(function(e, xhr, settings) {
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