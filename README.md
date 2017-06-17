# push-leboncoin
NodeJS app that scrap leboncoin.fr every minutes with the latest offers then send push notifications
- **Scrap le contenu d'un feed leboncoin**
- **Formate les données, filtre par mot-clé(s)** (nom / description d'annonce)
- **Sert une web app (via express)** pour s'enregistrer au flux de notif push
- **Envois les push aux devices enregistrées** dès qu'une annonce est récupérée par le scraper

## Structure
Le back d'un côté avec [server.js](server.js), et la web app ExpressJS (dans [public](public/))

## Requirements
Vous aurez besoin d'un [Projet Firebase](https://console.firebase.google.com/u/0/)<br>
3 fichiers doivent être modifiés / ajoutés avec vos clef d'api Firebase.
- [credientials.json](credientials.json) (Firebase > Mon projet > Paramètres du projet > [Onglet "Comptes & Services"](https://console.firebase.google.com/u/0/project/le_nom_de_ton_projet_ici/settings/serviceaccounts/adminsdk))
- [app.js](public/vendor/app.js#L58) (Firebase > Mon projet > Ajouter Firebase à votre application Web)
- [firebase-messaging-sw.js](public/firebase-messaging-sw.js) (Même clés que pour app.js)

## Usage
```js
npm install --only=production
node server.js
```
Au démarrage le serveur récupère la première page d'annonce et envois une push (pour le test)<br>
Timeout 3 minutes puis scrape la liste à nouveau, et pour toutes les nouvelles offres une push sera envoyée à tous les appareils enregistrés<br><br>

**Pour enregistrer son appareil afin qu'il reçoive les notifications** allez sur la web app [localhost:1337](http://localhost:1337) (par défaut) et acceptez les permissions du navigateur (Chrome, Firefox, Chrome Android etc...)
