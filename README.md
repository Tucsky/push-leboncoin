# push-leboncoin
Basicaly this is a implemtation of the Firebase cloud messaging quickstart for NodeJS<bt>
The app itself scrap leboncoin.fr every minutes with the latest offers then send push notifications<br>

- **Scrap le contenu d'un feed leboncoin**
- **Formate les données, filtre par mot-clé(s)** (nom / description d'annonce)
- **Sert une web app (via express)** pour s'enregistrer au flux de notif push
- **Envois les push aux devices enregistrées** dès qu'une annonce est récupérée par le scraper

## Requirements
Vous aurez besoin d'un [Projet Firebase](https://console.firebase.google.com/u/0/)<br>
Firebase fournit 2 fichiers conf, à intégrer au projet comme ceci :<br>
- [credientials.json](credientials.json) pour les *clés secretes* (Firebase > Mon projet > Paramètres du projet > [Onglet "Comptes & Services"](https://console.firebase.google.com/u/0/project/le_nom_de_ton_projet_ici/settings/serviceaccounts/adminsdk))
- [public/firebase-messaging-sw.js](public/firebase-messaging-sw.js) pour les *clés publiques* (Firebase > Mon projet > Ajouter Firebase à votre application Web)

## Usage
```js
npm install --only=production
node server.js
```
Au démarrage le serveur récupère la première page d'annonce et envois une push (pour le test)<br>
Timeout 3 minutes puis scrape la liste à nouveau, et pour toutes les nouvelles offres une push sera envoyée à tous les appareils enregistrés<br><br>

**Pour enregistrer son appareil afin qu'il reçoive les notifications** allez sur la web app [localhost:1337](http://localhost:1337) (par défaut) et acceptez les permissions du navigateur (Chrome, Firefox, Chrome Android etc...)

## Configuration
Les configurations se situent dans [config.js](config.js)

| Propriété | Description |
| ------ | ------ |
| url | Url leboncoin.fr pointant vers une liste d'annonces filtrée |
| port | Port du serveur |
| whitelist | Mot clés obligatoires dans la fiche de l'annonce (optionnel) |
| blacklist | Mot clés interdits dans la fiche de l'annonce (optionnel) |
| interval | Intervale de récupération des dernieres annonces (en ms) |
| countdown | Delais d'envois des notifications push (en ms, après récupération des annonces) |

## Développement
Le backend se situe dans [server.js](server.js), le front dans [public](public/) avec la logique frontend dans [public](public/vendor/app.js))<br>
Le projet utilise gulp pour minifier les ressources front en 2 fichiers app.min.js/css.<br>

Installez **gulp** si vous ne l'avez pas déjà fait<br>
```js
npm install -g gulp
```

Pour activer la compilation automatique du sass à la sauvegarde (et la minification automatique des fichiers .js)
```js
gulp watch
```
