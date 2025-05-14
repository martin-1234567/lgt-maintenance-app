# Application de Suivi de Maintenance des Véhicules

Cette application permet de suivre et d'enregistrer les opérations de maintenance sur les véhicules de train.

## Fonctionnalités

- Sélection d'un véhicule parmi les 12 disponibles
- Affichage du plan du véhicule sélectionné
- Ajout de points d'enregistrement en cliquant sur le plan
- Sélection du système et de l'opération pour chaque enregistrement
- Accès aux protocoles et fiches de traçabilité

## Installation

1. Cloner le dépôt
2. Installer les dépendances :
```bash
npm install
```

3. Démarrer l'application en mode développement :
```bash
npm start
```

## Structure des dossiers

- `/public/images` : Contient les plans des véhicules
- `/public/protocols` : Contient les protocoles PDF
- `/public/traceability` : Contient les fiches de traçabilité PDF
- `/src/components` : Composants React
- `/src/config` : Configuration des systèmes et opérations
- `/src/types` : Types TypeScript

## Déploiement

Pour déployer l'application en production :

1. Construire l'application :
```bash
npm run build
```

2. Déployer le contenu du dossier `build` sur votre serveur web

## Configuration

Les systèmes et opérations sont configurés dans le fichier `src/config/operations.ts`. Vous pouvez ajouter ou modifier les opérations selon vos besoins.

## Support

Pour toute question ou problème, veuillez contacter l'équipe de support.
