# Mise en place Google Cloud (une seule fois, environ 15 min)

Remplace `<compte>` par ton nom d'utilisateur GitHub.

1. Ouvre https://console.cloud.google.com/ et crée un projet nommé « vocab-review ».
2. Menu → API et services → Bibliothèque → « Google Drive API » → **Activer**.
3. Menu → Google Auth Platform → **Commencer** :
   - nom de l'application : Vocab Review ; e-mail d'assistance : ton adresse ;
   - audience : **Externe** ; coordonnées : ton adresse → Créer.
4. Google Auth Platform → **Audience** → Utilisateurs test → **Ajouter des utilisateurs** → ton adresse Gmail.
   Laisse le statut de publication sur **Test**.
5. Google Auth Platform → **Accès aux données** → Ajouter ou supprimer des champs d'application →
   coche `https://www.googleapis.com/auth/drive.readonly` → Mettre à jour → Enregistrer.
6. Google Auth Platform → **Clients** → Créer un client → type **Application Web**, nom « Vocab Review » :
   - origines JavaScript autorisées : `https://<compte>.github.io` et `http://localhost:5173` ;
   - URI de redirection autorisés : `https://<compte>.github.io/vocab-review/` et `http://localhost:5173/vocab-review/`
     (avec la barre oblique finale) ;
   - Créer, puis copie l'**ID client** (il finit par `.apps.googleusercontent.com`).

L'ID client n'est pas un secret : il est enregistré dans le fichier `.env` du dépôt.
À la première connexion, Google affiche « Google n'a pas validé cette application » :
c'est normal en mode Test. Choisis Continuer.
