# Fiche clinicien — V2

Widget Grist (vue fiche de la table **Cliniciens**) : bilan d'un clinicien tenant sur **une feuille A4 portrait**
(bouton « Imprimer / PDF », puis « Enregistrer au format PDF »). L'écran est un aperçu fidèle de l'impression :
si le contenu est long, la taille du texte est réduite automatiquement pour tenir sur la page.

Différences avec `fiche_clinicien/` (V1) :

- plus aucun `grist.docApi.fetchTable` : le widget ne lit **que** des colonnes de la table Cliniciens
  (accès « Lecture de la table » suffisant) ;
- les listes (RDV, permanences, actions de projets) arrivent par trois colonnes formules qui renvoient du JSON ;
- charte commune aux autres widgets (bandeau rouge, Montserrat / Zilla Slab), plus d'Alpine.js, de Pico ni de Chart.js.

Ouvrir `index.html?demo` (ou le fichier hors de Grist) pour un aperçu avec des données fictives.

## Colonnes à créer dans la table Cliniciens

Trois colonnes **formule**, de type **Texte**. Les noms de colonnes des autres tables sont ceux qu'utilisait la V1 ;
ceux marqués `# ← à adapter` sont à vérifier dans le document.

### `Fiche_RDV`

```python
import json

def iso(v):
  return v.isoformat() if v else None

return json.dumps([
  {
    "id": r.id_rdv_clinique,
    "statut": r.Statut_RDV,
    "creneau_1": iso(r.Creneau_RDV_1),
    "creneau_2": iso(r.Creneau_RDV_2),
    "heures": r.heures,
    "appreciation": r.Appreciation,  # ← à adapter : colonne de l'appréciation du RDV
  }
  for r in $Liste_RDV  # ← à adapter : colonne Liste de références vers RDV (associée à « Liste des rendez-vous » en V1)
], ensure_ascii=False)
```

L'appréciation est attendue sous la forme « Très satisfaisant », « Satisfaisant » ou « Peu satisfaisant »
(la casse et le féminin sont tolérés). Toute autre valeur est affichée telle quelle.

### `Fiche_permanences`

```python
import json

permanences = Permanences.lookupRecords(Cliniciens_affectes=CONTAINS($id), sort_by="Date_de_la_permanence")

return json.dumps([
  {
    "date": p.Date_de_la_permanence.isoformat() if p.Date_de_la_permanence else None,
    "heures": p.Heures_affectees,
    "commentaire": p.Commentaires,
  }
  for p in permanences
], ensure_ascii=False)
```

### `Fiche_projets`

Une entrée par action de projet attribuée ; le widget les regroupe par projet.

```python
import json

def libelle(valeur, colonne):
  # Colonne Référence : Grist renvoie l'enregistrement lié (non sérialisable en JSON),
  # on lit alors la colonne indiquée dans la table liée. Autre type : valeur inchangée.
  if hasattr(valeur, "_row_id"):
    return getattr(valeur, colonne) if valeur else None
  return valeur

return json.dumps([
  {
    "projet": libelle(a.Nom_du_projet, "Nom_du_projet"),  # Référence vers Projets : colonne du nom du projet
    "action": libelle(a.Action, "Action"),  # ← à adapter : intitulé de l'action
    "statut": libelle(a.Statut_du_projet, "Statut_du_projet"),
    "heures": a.heures,
  }
  for a in $Liste_projets  # ← à adapter : colonne Liste de références vers Actions_projets
], ensure_ascii=False)
```

Le second argument de `libelle` n'est utilisé que si la colonne est une Référence : c'est le nom de la colonne
à afficher dans la table liée (par exemple `Nom_du_projet` dans Projets).

### `Fiche_regulations` (facultative)

```python
import json

regulations = Regulations_heures.lookupRecords(Cliniciens=CONTAINS($id), sort_by="Cree_le")

return json.dumps([
  {
    "date": r.Cree_le.isoformat() if r.Cree_le else None,
    "motif": r.Motif,
    "heures": r.heures,
    "validee": r.Validee,
  }
  for r in regulations
], ensure_ascii=False)
```

Les régulations non validées sont affichées « en attente » et ne comptent pas dans le crédit, le débit et le net.

## Association des colonnes du widget

| Champ du widget | Colonne Cliniciens | Obligatoire |
| --- | --- | --- |
| Nom de famille, Prénom, Niveau | existantes | oui |
| Diplôme | existante | non |
| Option clinique | existante | non — si elle est associée et décochée, la fiche n'affiche aucune heure (ni régulations) |
| Heures totales | existante | oui |
| Heures RDV / projets / permanences / régulations (net) | existantes | non — à défaut, somme des listes JSON (régulations : validées uniquement) |
| Nb appréciations très satisfaisantes / satisfaisantes / peu satisfaisantes | existantes | non — à défaut, comptées dans `Fiche_RDV` |
| RDV (JSON), Permanences (JSON), Actions de projets (JSON) | `Fiche_RDV`, `Fiche_permanences`, `Fiche_projets` | oui |
| Régulations (JSON) | `Fiche_regulations` | non — sans elle, pas de détail des régulations |

L'objectif d'heures de la barre de progression est la constante `OBJECTIF_HEURES` de `script.js` (60 h, comme en V1).
