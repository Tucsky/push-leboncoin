$(document).ajaxComplete(function(e, xhr, settings) {
	var response = xhr.responseJSON || {};

	if (response.error)
		snap(response.error, {color: 'red'});
	else {
		switch (xhr.status) {
			case 404:
				snap('The resource "'+settings.url+'" cannot be found', {color: 'red'});
			break;
		}
	}

	if (response.message)
		snap(response.message, {color: 'blue'});
});

firebase.initializeApp({
	apiKey: "AIzaSyCRSoBL6dKwZ-jlp22oXagCRVIKFOQBsvs",
	authDomain: "project-2792471436428079009.firebaseapp.com",
	databaseURL: "https://project-2792471436428079009.firebaseio.com",
	projectId: "project-2792471436428079009",
	storageBucket: "project-2792471436428079009.appspot.com",
	messagingSenderId: "855601272318"
});

var messaging = firebase.messaging();

var token;

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
	$('#registrationBlock')[!state ? 'slideUp' : 'slideDown'](200)
		.find('.token')
		.val(newToken);
}

function subscribe() {
	messaging.requestPermission().then(function() {
		checkSubscription();
	}).catch(function() {
		snap('The permission request was dismissed');
	})
}

function checkSubscription() {
	messaging.getToken().then(register).catch(function() {
		setAsRegistered(false);
		snap('No token found');
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

function get(page) {
	var page = page || 0;

	$.ajax({
		url: 'offers',
		type: 'POST',
		data: {
			page: page,
		}
	}).done(function(response) {
		if (!response.success)
			return;

		if (!response.offers || !response.offers.length)
			return snap('Nothing to display yet', {color: 'red'});

		response.offers.forEach(function(offer) {
			var $offer = $('#'+offer.id),
				exists = $offer.length;

			$offer = exists ? $offer : $('<div/>', {id: offer.id, class: 'offer col-xs-12 col-sm-6 col-md-4'}).html('<div class="card">\
				'+(offer.images.length ? '<img class="card-img-top" src="" alt="'+offer.title+'">' : '')+'\
				<div class="card-block">\
					<h4 class="card-title"></h4>\
					<p class="card-text"></p>\
					<a href="#" class="btn btn-primary" data-action="show">Show</a>\
				</div>\
				<div class="card-footer text-muted">'+offer.date+'</div>\
			</div>');

			if (offer.images.length) {
				$offer.find('.card-img-top').one('load', function() {
					$offer.addClass('offer-loaded');
				}).attr('src', 'img/leboncoin/'+offer.images[0]).attr('alt', offer.title);
			} else {
				$offer.addClass('offer-loaded');
			}

			$offer.find('.card-title').text(offer.title);
			$offer.find('.card-text').text(offer.description);
			$offer.find('.card-footer').text(offer.date);
			$offer.find('a').attr('href', 'https://www.leboncoin.fr/velos/'+offer.id+'.htm');

			if (!exists)
				$('.row').append($offer);

			$offer.show();
		})
	})
}

get(0);