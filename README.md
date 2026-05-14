# Galerie Mariage Maelle & William

Site premium (HTML + CSS + JS + serveur Node) pour presenter les photos/videos du mariage avec upload persistant par section.

## 0) Lancer le site avec sauvegarde reelle des uploads

Pour que les ajouts depuis la page soient vraiment sauvegardes sur le serveur (et donc visibles en ligne), utilisez le serveur Node :

```bash
npm install
npm start
```

Puis ouvrez `http://localhost:8000`.

Le backend enregistre les fichiers dans :

- `assets/photos/<section>/`
- `assets/videos/<section>/`

et met a jour `data/media-manifest.json`.

## 1) Ajouter ou remplacer les medias (photos + videos)

1. Placez vos photos dans ces sous-dossiers :
   - `assets/photos/mairie/`
   - `assets/photos/vin-dhonneur/`
   - `assets/photos/ceremonie-henne/`
   - `assets/photos/soiree/`
2. Placez vos videos dans ces sous-dossiers :
   - `assets/videos/mairie/`
   - `assets/videos/vin-dhonneur/`
   - `assets/videos/ceremonie-henne/`
   - `assets/videos/soiree/`
3. La galerie charge automatiquement les medias presents dans ces sous-dossiers (aucune edition HTML necessaire).
4. Pour les photos, le compteur "Photos" se met a jour automatiquement.
5. Conservez des noms de fichiers clairs (ex: `mairie-01.jpg`, `henne-danse-02.mp4`).

### Chargement automatique de la galerie

- Le script scanne automatiquement :
  - `assets/photos/mairie/`
   - `assets/photos/vin-dhonneur/`
   - `assets/photos/ceremonie-henne/`
   - `assets/photos/soiree/`
  - `assets/videos/mairie/`
   - `assets/videos/vin-dhonneur/`
   - `assets/videos/ceremonie-henne/`
   - `assets/videos/soiree/`
- Les boutons de filtre utilisent les categories : `mairie`, `vin-dhonneur`, `soiree`, `ceremonie-henne`.
- Les photos s'ouvrent dans la lightbox. Les videos restent lues directement dans la galerie.
- Pour les videos `.MOV`, le site utilise des posters PNG generes localement dans `assets/posters/` pour afficher la premiere image.

### Regenerer les miniatures des videos

Depuis le dossier `wedding-william-maelle`, lancez :

```bash
./scripts/generate-video-posters.sh
```

Le script parcourt `assets/videos/*` et genere les posters dans `assets/posters/*`.

### Generer des versions web de meilleure qualite

Pour lire les videos iPhone dans le navigateur sans perdre trop de qualite :

```bash
./scripts/generate-video-web.sh
```

Le script convertit les `.MOV` en `.m4v` 1080p multipass dans `assets/videos-web/*`.

### Categories videos (mariage)

Utilisez ces valeurs exactes dans `data-category` :

- `mairie`
- `vin-dhonneur`
- `soiree`
- `ceremonie-henne`

Exemple video (si vous voulez ajouter un bloc manuellement) :

```html
<figure class="gallery-item media-video reveal fade-up" data-category="ceremonie-henne">
   <video controls preload="metadata" playsinline>
      <source src="assets/videos/ceremonie-henne/henne-01.mp4" type="video/mp4" />
      Votre navigateur ne prend pas en charge la video.
   </video>
   <figcaption class="video-caption">Soiree de l'henne</figcaption>
</figure>
```

## 2) Modifier les textes (noms, date, citations)

Dans `index.html`, modifiez directement :

- Hero : `Maelle & William`, `Unis pour toujours`, date du mariage
- Section histoire : citation et titres timeline
- Section jour J : horaires et descriptions
- Section temoignages : message des maries et avis invites
- Footer : monogramme, date, texte final

## 3) Changer les couleurs facilement

Toutes les couleurs sont centralisees dans `css/main.css` (bloc `:root`) :

- `--lavender-main`
- `--lavender-light`
- `--lavender-deep`
- `--ivory`
- `--gold-soft`
- `--text-main`
- `--text-secondary`

Modifiez uniquement ces variables pour changer tout le theme du site.

## 4) Structure CSS et JS

### CSS
- `css/main.css` : variables, reset, base, hero, loader, curseur
- `css/layout.css` : sections, grilles, timeline, footer
- `css/components.css` : navbar, boutons, filtres, carousel
- `css/gallery.css` : masonry, hover photos, lightbox
- `css/animations.css` : keyframes, reveals, petals, particules
- `css/mobile.css` : responsive (1440 / 1024 / 768 / 480)

### JS
- `js/utils.js` : loader, curseur coeur, compteurs, menu mobile
- `js/animations.js` : reveals scroll, navbar flottante, section active, progression Jour J
- `js/gallery.js` : filtres galerie, lightbox, navigation clavier + swipe mobile
- `js/carousel.js` : carousel temoignages auto + touch

## 5) Deployer le site

Pour garder l'upload persistant, deployez sur un hebergeur qui supporte Node.js (Render, Railway, VPS, etc.).

Commandes de demarrage :

```bash
npm install
npm start
```

Si vous deployez en statique pur (GitHub Pages, Netlify statique), l'upload depuis le navigateur ne pourra pas sauvegarder les fichiers sur le serveur.

## 6) Conseils qualite

- Utilisez des images optimisees (WebP/JPG compresse, largeur 1600-2200px max).
- Gardez les `alt` explicites pour l'accessibilite.
- Testez sur mobile et desktop apres chaque ajout.
- Si vous ajoutez beaucoup de photos, dupliquez simplement les blocs `<figure class="gallery-item">` existants.
