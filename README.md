# Business Room — Backend NestJS

Plateforme communautaire d'épargne, d'investissement, de marketplace et de microcrédit.
Backend construit en **NestJS 10** + **Prisma 5** + **PostgreSQL**, avec authentification
**Firebase** (Google / Apple / téléphone) et **JWT** interne, planification via
`@nestjs/schedule`, documentation **OpenAPI/Swagger**.

---

## Sommaire

- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Démarrage rapide](#démarrage-rapide)
- [Variables d'environnement](#variables-denvironnement)
- [Scripts](#scripts)
- [Modules métier](#modules-métier)
- [Sécurité](#sécurité)
- [Tests Postman](#tests-postman)
- [Docker](#docker)

---

## Architecture

```
src/
├── main.ts                       Bootstrap (Helmet, CORS, Swagger, filtres, pipes globaux)
├── app.module.ts                 Composition racine + guards globaux
├── config/                       Validation des variables d'environnement (class-validator)
├── common/
│   ├── prisma/                   PrismaService global
│   ├── guards/                   JwtAuthGuard, RolesGuard, MembershipActiveGuard
│   ├── decorators/               @Public, @Roles, @CurrentUser
│   ├── filters/                  Exceptions HTTP + Prisma
│   ├── interceptors/             Response wrapper { success, data }
│   └── utils/                    Génération matricule / code de parrainage
└── modules/
    ├── auth/                     Register / Login / Firebase / Refresh / Profil complémentaire
    ├── users/                    Profil du membre courant
    ├── membership/               Adhésion 10 000 FCFA → attribution matricule
    ├── referral/                 Résumé du parrainage
    ├── savings/                  Épargne journalière / hebdomadaire / bloquée
    ├── investors/                Formulaire investisseur + accès aux projets
    ├── entrepreneurs/            Formulaire porteur de projet + accès aux investisseurs
    ├── marketplace/              File d'attente tournante + cron quotidien
    ├── partnership/              Packs CFPAM, valeur d'action, portefeuille, dividendes
    ├── cashbook/                 Cahiers de caisse multi-cahiers + stats
    ├── loans/                    Simulation + demande (JSE / Activité existante) + plafond parrainage
    ├── assistance/               Catégories + messages
    ├── notifications/            In-app + broadcast
    ├── admin/                    Back-office (files d'attente, retraits, rôles)
    └── wallet/                   Portefeuille interne + intégration MoneyFusion (recharge, paiements internes, webhook)
prisma/
├── schema.prisma
└── seed.ts
postman/                          Collection à importer dans Postman
postman-test/                     Scénarios de test manuels
```

### Choix techniques

- **Prisma** pour l'ORM (schémas, migrations, transactions atomiques).
- **BigInt** pour tous les montants FCFA : évite toute perte de précision.
- **Guards globaux** : JWT + Roles enregistrés via `APP_GUARD`, opt-out par `@Public()`.
- **Multi-tenancy des rôles** : un utilisateur cumule `Role[]` (MEMBER, INVESTOR, ENTREPRENEUR, PARTNER, ADMIN, SUPER_ADMIN_CFPAM).
- **Guard dédié** `MembershipActiveGuard` pour interdire les fonctions premium sans adhésion.
- **Firebase Admin SDK** côté serveur pour vérifier les ID tokens (Google / Apple / phone) — activation automatique quand les 3 variables `FIREBASE_*` sont fournies.
- **Réponses uniformes** `{ success, data }` via un interceptor global.
- **Rate limiting** global via `@nestjs/throttler`.
- **Cron** quotidien à minuit pour la rotation marketplace (`MarketplaceScheduler`).

---

## Prérequis

- Node.js **20+**
- PostgreSQL **14+**
- (Optionnel) Compte Firebase pour l'auth sociale/téléphone

## Démarrage rapide

```bash
cp .env.example .env
# Editer .env (DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, FIREBASE_*)

npm install
npx prisma migrate dev --name init
npm run seed
npm run start:dev
```

- API : http://localhost:3000/api/v1
- Swagger : http://localhost:3000/api/v1/docs

## Variables d'environnement

Voir `.env.example`. Toutes sont validées au démarrage via `class-validator`.
**Aucune clé privée n'est committée** : `FIREBASE_PRIVATE_KEY`, `JWT_SECRET`,
`JWT_REFRESH_SECRET` doivent être fournies par variable d'environnement.
Le `.gitignore` exclut `.env` par défaut.

## Scripts

| Script | Rôle |
|--------|------|
| `npm run start:dev` | Serveur dev avec watch |
| `npm run build` | Build production |
| `npm run start:prod` | Exécution production |
| `npm run prisma:migrate` | Migration schéma |
| `npm run prisma:deploy` | Migration en production |
| `npm run prisma:studio` | UI Prisma |
| `npm run seed` | Injection des données de démonstration |
| `npm run lint` | ESLint |
| `npm test` | Tests unitaires |

## Modules métier

### Adhésion & parrainage
- Adhésion 10 000 FCFA (`MEMBERSHIP_FEE_XOF`). À la validation admin, un **matricule** unique est généré.
- Un membre ne peut parrainer que s'il est actif. Le back valide chaque code de parrainage.

### Épargne
| Type | Formule totale | Multiple | Durée |
|------|----------------|----------|-------|
| DAILY | `(objectif + 20%) / 2` | 1 200 | `total / journalier` (arrondi ↑) |
| WEEKLY | `objectif + 10%` | 6 100 | `total / hebdomadaire` (arrondi ↑) |
| BLOCKED | `objectif` | — | 365 jours, bonus immédiat 25% |

### Marketplace
- File FIFO par `queuePosition`.
- Chaque jour à minuit, les 3 premières publications sont marquées `featuredToday=true`
  et repositionnées en fin de file.
- Le membre partage son numéro WhatsApp : le front doit générer un lien `wa.me/...`.

### Prêts
- Simulation : intérêt 5 %, assurance 6,5 %, mensualité = total / durée (arrondie).
- Plafond : `n filleuls actifs × 50 000 FCFA`.
- Catégorie JSE : ≥ 3 filleuls actifs, équipe de 3 à 5 membres tous adhérents actifs, projet fourni.

### Partnership CFPAM
- Packs d'actions configurables par le super-admin.
- Valeur d'action saisie manuellement, historisée.
- Achat / revente en transactions `PENDING` → validation admin → mise à jour du holding.

### Cahier de caisse
- N cahiers par membre, solde calculé automatiquement à chaque opération,
  journal du mois, stats du jour.

## Sécurité

- **Guards globaux** JWT + Roles. Endpoints publics explicites via `@Public()`.
- **Helmet** (en-têtes de sécurité), **CORS** contrôlé, **compression**.
- **Rate limiting** (throttler) 100 req/min par défaut.
- **Hashing bcrypt** (12 rounds par défaut).
- **Validation stricte** de toutes les entrées via `class-validator` + `whitelist + forbidNonWhitelisted`.
- **Aucune clé privée dans le code** : Firebase / JWT / DB via `.env`.
- **Filtre Prisma** dédié : les erreurs base de données ne fuitent jamais d'infos internes.
- **Séparation des rôles** : `SUPER_ADMIN_CFPAM` seul autorisé à modifier la valeur d'action.

## Tests Postman

- Collection : `postman/business-room.postman_collection.json`
- Environnement : `postman/business-room.postman_environment.json`
- Scénarios : `postman-test/SCENARIOS.md`

La collection enchaîne automatiquement : Auth → Membership → Referral → Savings →
Marketplace → Investors → Entrepreneurs → Partnership → Cashbook → Loans →
Assistance → Notifications → Admin. Les variables (tokens, IDs) sont capturées
automatiquement par les scripts de test.

## Docker

```bash
docker compose up --build
```

Lance PostgreSQL + API (port 3000).

---

© Business Room. Tous droits réservés.
# Final-backend-business-room
