# 08 — Tâches planifiées

> La première chose à désapprendre en serverless : `setInterval` ne
> fonctionne pas. Le processus n'est pas maintenu en vie entre deux
> requêtes.

---

## Pourquoi `setInterval` ne marche pas

```ts
// ❌ tourne peut-être une fois, jamais deux, et différemment selon l'instance
setInterval(() => nettoyer(), 60_000);
```

Une fonction serverless démarre pour une requête et s'arrête après. Il n'y
a pas de processus à qui confier un intervalle. Le code n'échoue pas — il
ne s'exécute simplement pas, ce qui est bien pire à diagnostiquer.

La forme correcte : **une route HTTP, appelée par un planificateur
externe.**

```jsonc
// vercel.json
{ "crons": [{ "path": "/api/cron/outbox-drain", "schedule": "* * * * *" }] }
```

---

## Chaque cron est une route protégée

```ts
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const refus = verifyCronSecret(req);    // Authorization: Bearer ${CRON_SECRET}
  if (refus) return refus;
  // …
}
```

Sans ce contrôle, **n'importe qui sur Internet peut déclencher ton travail
de fond** : vider ta boîte d'envoi en boucle, relancer tes e-mails,
déclencher tes appels à une API payante.

→ [`code/verify-cron-secret.ts`](code/verify-cron-secret.ts)

---

## L'inventaire type

| Tâche | Fréquence | Rôle |
|---|---|---|
| `outbox-drain` | 1 min | Vide la boîte d'envoi transactionnelle |
| `email-queue-drain` | 1 min | Envoie les e-mails en file |
| **`paiements-en-attente`** | 1–5 min | **Le filet** : interroge le prestataire sur les commandes encore en attente |
| `order-expiration` | 5 min | Expire les commandes non payées |
| `verification-cleanup` | 1 h | Purge les codes de vérification périmés |
| `*-purge` | 1 j | Rétention des journaux et des e-mails envoyés |
| Rappels | 1 j | Échéances, renouvellements |

La ligne en gras n'est pas optionnelle dès qu'il y a de l'argent.
→ [module 02](../02-paiements/#4-le-webhook-peut-ne-jamais-arriver)

---

## Les quatre propriétés d'un bon cron

**1. Idempotent.** Il tournera deux fois. Un planificateur qui n'a pas reçu
de réponse réessaie.

**2. Par lots, borné.** `take: 100`, pas « tout ». Une fonction a une durée
maximale ; un cron qui dépasse est tué au milieu, et tu ne sauras pas où.

**3. Réclamation atomique.** Deux exécutions simultanées ne doivent pas
traiter la même ligne :

```ts
// on marque comme pris AVANT de traiter, en une seule écriture conditionnelle
const { count } = await prisma.job.updateMany({
  where: { id, statut: 'PENDING' },      // ← la condition fait l'exclusion
  data: { statut: 'PROCESSING' },
});
if (count === 0) return;                  // quelqu'un d'autre l'a pris
```

**4. Observable.** Il journalise ce qu'il a fait, et compte. Un cron
silencieux qui ne tourne plus depuis trois semaines, personne ne le
remarque.

```ts
log.info('cron.outbox_drain.fini', { traites: n, echoues: e, duree_ms: d });
```

---

## Verrou entre instances

Quand deux instances peuvent lancer le même travail, un bail Redis à durée
limitée désigne un seul exécutant :

```ts
if (!(await acquerirBail('cron:veille', 300))) return;   // un autre l'a
```

Le bail **expire** tout seul — c'est le point important. Un verrou qui
n'expire pas et dont le porteur meurt bloque le travail pour toujours.

→ [`code/leader-lease.ts`](code/leader-lease.ts)

---

## Garder l'inventaire honnête

Le décalage le plus courant : une route de cron supprimée dont l'entrée
reste dans `vercel.json`, ou l'inverse. Le premier cas donne un 404 toutes
les minutes ; le second, un travail qui ne tourne jamais.

Écris le test qui compare les deux listes. C'est dix lignes, et ça tient
tout seul pour toujours.

---

## Pièges vécus

| Symptôme | Cause |
|---|---|
| Le travail de fond ne tourne jamais | `setInterval` en serverless |
| Des inconnus déclenchent tes tâches | Pas de `CRON_SECRET` |
| Un cron tué au milieu | Pas de bornage par lots |
| Lignes traitées deux fois | Réclamation non atomique |
| Un cron arrêté depuis des semaines | Pas de journalisation |
| Un travail bloqué pour toujours | Verrou sans expiration |
| 404 toutes les minutes | Entrée orpheline dans `vercel.json` |
