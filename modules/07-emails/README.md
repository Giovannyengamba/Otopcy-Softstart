# 07 — E-mails et notifications

> Un e-mail qui ne part pas est invisible. Personne ne dépose de ticket
> pour un message qu'il n'a pas reçu — il part, tout simplement.

---

## Avant le code : le domaine

Un e-mail envoyé depuis une adresse non authentifiée finit en indésirable,
ou nulle part. Trois enregistrements DNS, non négociables :

| Enregistrement | Rôle |
|---|---|
| **SPF** | Quels serveurs ont le droit d'envoyer pour ce domaine |
| **DKIM** | Signature cryptographique de chaque message |
| **DMARC** | Que faire quand SPF ou DKIM échoue |

Et la règle qui fait la différence : **envoie depuis ton domaine**, jamais
depuis une adresse en `gmail.com`. Un `noreply@` fonctionne
techniquement ; une adresse qui accepte les réponses vaut mieux, parce que
les gens répondent.

> Sur le produit d'origine, **aucun e-mail ne partait** pendant des
> semaines, sans la moindre erreur dans les journaux : le domaine n'était
> pas vérifié chez le prestataire. Vérifie l'envoi de bout en bout, vers
> une vraie boîte, avant de considérer que c'est fait.

---

## Une file d'attente, pas un `await`

```ts
// ❌ l'utilisateur attend l'API du prestataire ; si elle tombe, l'inscription échoue
await envoyerEmail(…);
return NextResponse.json({ ok: true });

// ✅ une ligne en base, une tâche planifiée qui draine
await tx.emailJob.create({ data: { to, template, payload, statut: 'PENDING' } });
```

Trois gains immédiats :

1. **La réponse est rapide** — l'utilisateur n'attend pas un tiers.
2. **Une panne du prestataire ne casse rien** — les messages s'accumulent
   et partent après.
3. **Les tentatives sont espacées** automatiquement.

Le drain marque `SENT` ou incrémente `attempts` avec un délai croissant.
Au-delà de N tentatives, `FAILED` et une alerte — un message qui échoue en
boucle silencieusement est pire que pas de file.

Et purge les `SENT` de plus de X jours : une table d'e-mails est une table
de données personnelles.

### Le lien avec la boîte d'envoi

La file d'e-mails et la boîte d'envoi transactionnelle
([module 02](../02-paiements/#3-les-effets-de-bord-passent-par-la-boîte-denvoi))
sont deux choses distinctes, et il faut les deux :

- la **boîte d'envoi** garantit que l'intention est enregistrée dans la
  même transaction que le fait métier (paiement enregistré ⟺ e-mail promis) ;
- la **file d'e-mails** garantit la livraison ensuite, avec ses tentatives.

Boîte d'envoi → file d'e-mails → prestataire.

---

## Notifications : le doublon est la règle, pas l'exception

Une tâche planifiée qui tourne deux fois, un webhook rejoué, un
redéploiement au mauvais moment : le même message part deux fois. Ne compte
pas sur la discipline.

```prisma
model Notification {
  dedupeKey String  @unique      // 'club.echeance.<userId>.<J-7>'
}
```

La clé contient **tout ce qui rend l'événement unique**, y compris la
fenêtre temporelle. Le second appel échoue sur la contrainte, on attrape,
on ignore.

Et une seule porte d'entrée : `createNotification(prisma, input)`. Un appel
direct à `prisma.notification.create` contourne le rattrapage du doublon —
c'est le genre de règle qui mérite un test qui la surveille.

---

## Ce qu'on met dans un e-mail

| Toujours | Jamais |
|---|---|
| Pourquoi la personne le reçoit | Un mot de passe en clair |
| Un lien de désabonnement (pour tout ce qui n'est pas transactionnel) | Un jeton de session |
| Une version texte à côté du HTML | Une image porteuse de l'information essentielle |
| Une adresse de réponse qui fonctionne | Un lien vers `localhost` |

**Transactionnel ≠ marketing.** Un reçu n'a pas besoin de désabonnement ;
une lettre d'information, si — et c'est une obligation légale, pas une
politesse.

**Le HTML d'e-mail n'est pas du HTML.** Tableaux, styles en ligne, pas de
flexbox, pas de grille. Teste sur au moins trois clients.

---

## Pièges vécus

| Symptôme | Cause |
|---|---|
| Rien ne part, aucune erreur | Domaine non vérifié chez le prestataire |
| Tout finit en indésirable | SPF/DKIM/DMARC absents |
| Doublons à chaque redéploiement | Pas de clé de déduplication |
| L'inscription échoue quand le prestataire tombe | Envoi synchrone |
| Un e-mail échoue en boucle sans que personne le sache | Pas de plafond de tentatives, pas d'alerte |
| Liens cassés en production | URL construite depuis une variable absente |
