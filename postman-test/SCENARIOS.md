# Scénarios de test - Business Room

## Prérequis
1. `npm install && npx prisma migrate deploy && npm run seed`
2. Démarrer : `npm run start:dev`
3. Importer `postman/business-room.postman_collection.json` dans Postman.

## Comptes seed
| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@businessroom.test | Admin@123456 |
| Membre actif (Alice, INVESTOR) | alice@businessroom.test | Alice@123456 |
| Membre actif (Bob, ENTREPRENEUR, filleul d'Alice) | bob@businessroom.test | Bob@123456 |
| Membre en attente | pending@businessroom.test | Pending@123456 |

## Scénario complet
1. Auth > Login (Admin) → `adminToken`.
2. Auth > Login (Alice) → `accessToken`.
3. Referral > Summary — vérifier 1 filleul actif (Bob).
4. Savings > Simulate DAILY (goal 1M, 1200/j) — total 600 000, 500 jours.
5. Savings > Create + Contribute.
6. Marketplace > Publish product (queue).
7. Marketplace > [ADMIN] Rotate — les 3 premiers passent en `featuredToday`.
8. Partnership > Packs > Buy > [ADMIN] Approve tx > Portfolio.
9. Cashbook > Create > Add INCOME/EXPENSE > Today stats.
10. Loans > Simulate > Apply (EXISTING_ACTIVITY, ≤ n×50 000) > [ADMIN] Approve/Disburse > Repay.
11. Auth > Register (nouveau) > Membership Request > [ADMIN] Validate — matricule attribué.
12. Assistance > Categories > Send message.
13. Admin > Dashboard.

## Règles métier vérifiées
- Adhésion active requise (guard `MembershipActiveGuard`) pour savings, marketplace, cashbook, loan apply.
- Parrainage refusé si le parrain n'est pas actif.
- Prêt JSE : 3 filleuls actifs + équipe 3–5 + projet.
- Plafond prêt = n × 50 000 FCFA.
- Épargne journalière multiple de 1 200 ; hebdo multiple de 6 100 ; bloquée bonus 25%, 365 jours.
- Marketplace : cron quotidien minuit (`@nestjs/schedule`).
