# push-leboncoin
Basicaly this is a implemtation of the Firebase cloud messaging quickstart for NodeJS<bt>
The app itself scrap leboncoin.fr every minutes with the latest offers then send push notifications<br>
It just monitor ONE url for now, the default config aim to scrap Paris bike related offers (see #[configuration](#user-content-configuration))<br>

- **Scrap le contenu d'un feed leboncoin**
- **Formate les données, filtre par mot-clé(s)** (nom / description d'annonce)
- **Sert une web app (via express)** pour s'enregistrer au flux de notif push
- **Envois les push aux devices enregistrées** dès qu'une annonce est récupérée par le scraper

## Requirements
Vous aurez besoin d'un [Projet Firebase](https://console.firebase.google.com/u/0/)<br>
Firebase fournit 2 fichiers conf, à intégrer au projet comme ceci :<br>
- [public/worker.js](public/worker.js) pour les *clés publiques* (Firebase > Mon projet > Ajouter Firebase à votre application Web)
- [credientials.json](credientials.json) pour les *clés secretes* (Firebase > Mon projet > Paramètres du projet > [Onglet "Comptes & Services"](https://console.firebase.google.com/u/0/project/le_nom_de_ton_projet_ici/settings/serviceaccounts/adminsdk))

## Usage
```js
npm install --only=production
node server.js
```
Au démarrage le serveur récupère la première page d'annonce et envois une push de test, ensuite l'app va scrape la liste toutes les 5 minutes (paramétrable) en envoyant un push à tous les appareils enregistrés et ce pour toutes les nouvelles qui sont conforme au filtres (blacklist/whitelist)<br><br>

### Enregistrement des appareils
Pour recevoir les push un appareil doit autoriser les notifications depuis sont navigateur (chrome/firefox/android) lors de l'autorisation le serveur garde le token généré en mémoire et s'en servira pour envoyer les notifs.
Pour enregistrer l'appareil l'utilisateur doit aller sur la web app [localhost:1337](http://localhost:1337) (port configurable :) et acceptez les permissions "autoriser les notifications".

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

Le fichier de conf se créé **automatiquement** au premier démarrage et prend les valeurs par défaut suivantes
```json
{
	"url": "https://www.leboncoin.fr/velos/offres/ile_de_france/?th=1&ps=6&pe=12",
	"port": 1337,
	"whitelist": [],
	"blacklist": [],
	"countdown": 10000,
	"interval": 180000
}
```

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
