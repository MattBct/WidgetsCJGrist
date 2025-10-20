class Column {
    constructor(name, title, optionnal, type, description, allowMultiple){
        this.name = name;
        this.title = title;
        this.optionnal = optionnal;
        this.type = type;
        this.description = description;
        this.allowMultiple = allowMultiple;
    }
}

class DateColumn extends Column {
    constructor(name, title, optionnal = false, description = ''){
        super(name, title, optionnal, 'DateTime', description, false);
    }
}

class LieuColumn extends Column {
    constructor(name, title, optionnal = false, description = ''){
        super(name, title, optionnal, 'Choice', description, false);
    }
}


const CALENDAR_ID = 'calendar'
const TITRE_NAME_COLUMN = new Column("Titre", "Titre du RDV", false, "Text", "Titre affiché dans le calendrier", false);
const CRENEAUX_RDV = [
    {
        cols: {
            date: new DateColumn("Creneau_RDV_1", "Créneau RDV 1"),
            lieu: new LieuColumn("Lieu_RDV_1", "Lieu RDV 1"),
        },
        ordre: 1,
        backgroundColor: "#CDD6DD",
    },
    {
        cols: {
            date: new DateColumn("Creneau_RDV_2", "Créneau RDV 2"),
            lieu: new LieuColumn("Lieu_RDV_2", "Lieu RDV 2"),
        },
        ordre: 2,
        backgroundColor: "#CCFBFE"
    },

]

const CHRONOLOGIE = [
    {
        label: "RDV initial",
        ordre: 1,
        emoji: "🥇"
    },
    {
        label: "RDV de restitution",
        ordre: 2,
        emoji: "🥈"
    },
]


const DUREE_RDV_DEFAULT = {
    minutes: 30
}

const sampleDossiersAnonymises = [
  {
    "id": 1,
    "Patient": "Patient_001",
    "Statut": "Annulé",
    "Mail_patient": "patient001@example.com",
    "Telephone_patient": "",
    "Visioconference": false,
    "Etudiants_option": [],
    "Commentaires": "",
    "Autres_etudiants": [],
    "Formulaire_usager": null,
    "Type_de_RDV": "Grand public",
    "Lieu_RDV_2": "Palais - Salle de travail enseignants",
    "Creneau_RDV_2": "2025-10-30T15:30:00.000Z",
    "Avocats_presents": null,
    "Motif_du_RDV": "Droit du Travail (licenciement pour inaptitude physique)",
    "Origine": "",
    "Pieces_jointes_patient": null,
    "Lieu_RDV_1": "Palais - Commissions",
    "Creneau_RDV_1": "Annulé"
  },
  {
    "id": 2,
    "Patient": "Patient_002",
    "Statut": "Annulé",
    "Mail_patient": "patient002@example.com",
    "Telephone_patient": "",
    "Visioconference": false,
    "Etudiants_option": {
      "name": "InvalidTypedValue",
      "message": "RefList",
      "details": "Etudiant_001"
    },
    "Commentaires": "",
    "Autres_etudiants": {
      "name": "InvalidTypedValue",
      "message": "RefList",
      "details": "Etudiant_002"
    },
    "Formulaire_usager": null,
    "Type_de_RDV": "Grand public",
    "Lieu_RDV_2": "",
    "Creneau_RDV_2": null,
    "Avocats_presents": null,
    "Motif_du_RDV": "Droit pénal (agression) ",
    "Origine": "",
    "Pieces_jointes_patient": null,
    "Lieu_RDV_1": "",
    "Creneau_RDV_1": null
  },
  {
    "id": 3,
    "Patient": "Patient_003",
    "Statut": "Premier rendez-vous",
    "Mail_patient": "patient003@example.com",
    "Telephone_patient": "",
    "Visioconference": false,
    "Etudiants_option": [],
    "Commentaires": "",
    "Autres_etudiants": [],
    "Formulaire_usager": null,
    "Type_de_RDV": "Grand public",
    "Lieu_RDV_2": "Palais - Assesseurs",
    "Creneau_RDV_2": "2025-11-20T18:30:00.000Z",
    "Avocats_presents": null,
    "Motif_du_RDV": "Droit immo (litige avec bail solidaire)",
    "Origine": "",
    "Pieces_jointes_patient": null,
    "Lieu_RDV_1": "Palais - Assesseurs",
    "Creneau_RDV_1": "2025-11-06T18:30:00.000Z"
  },
  {
    "id": 4,
    "Patient": "Patient_004",
    "Statut": "Premier rendez-vous",
    "Mail_patient": "patient004@example.com",
    "Telephone_patient": "",
    "Visioconference": false,
    "Etudiants_option": [],
    "Commentaires": "",
    "Autres_etudiants": [],
    "Formulaire_usager": null,
    "Type_de_RDV": "Grand public",
    "Lieu_RDV_2": "Palais - Formation continue",
    "Creneau_RDV_2": "2025-11-27T18:30:00.000Z",
    "Avocats_presents": null,
    "Motif_du_RDV": "Droit du travail",
    "Origine": "",
    "Pieces_jointes_patient": null,
    "Lieu_RDV_1": "Palais - Formation continue",
    "Creneau_RDV_1": "2025-11-06T18:30:00.000Z"
  },
  {
    "id": 5,
    "Patient": "Patient_005",
    "Statut": "Premier rendez-vous",
    "Mail_patient": "patient005@example.com",
    "Telephone_patient": "",
    "Visioconference": true,
    "Etudiants_option": [],
    "Commentaires": "",
    "Autres_etudiants": [],
    "Formulaire_usager": null,
    "Type_de_RDV": "Grand public",
    "Lieu_RDV_2": "Palais - N/A",
    "Creneau_RDV_2": "2025-11-20T18:00:00.000Z",
    "Avocats_presents": null,
    "Motif_du_RDV": "Droit des étrangers (pb droit immobilier)",
    "Origine": "",
    "Pieces_jointes_patient": null,
    "Lieu_RDV_1": "Palais - N/A",
    "Creneau_RDV_1": "2025-11-06T18:00:00.000Z"
  },
  {
    "id": 6,
    "Patient": "Patient_006",
    "Statut": "Premier rendez-vous",
    "Mail_patient": "patient006@example.com",
    "Telephone_patient": "",
    "Visioconference": false,
    "Etudiants_option": [],
    "Commentaires": "",
    "Autres_etudiants": [],
    "Formulaire_usager": null,
    "Type_de_RDV": "Grand public",
    "Lieu_RDV_2": "Palais - Assesseurs",
    "Creneau_RDV_2": "2025-11-27T17:00:00.000Z",
    "Avocats_presents": null,
    "Motif_du_RDV": "Litige suite fermage",
    "Origine": "",
    "Pieces_jointes_patient": null,
    "Lieu_RDV_1": "Palais - Commissions",
    "Creneau_RDV_1": "2025-11-06T17:00:00.000Z"
  },
  {
    "id": 7,
    "Patient": "Patient_007",
    "Statut": "Premier rendez-vous",
    "Mail_patient": "patient007@example.com",
    "Telephone_patient": "",
    "Visioconference": false,
    "Etudiants_option": [],
    "Commentaires": "Le patient a envoyé des documents - écrire à cliniquejuridique@univ-lyon3.fr pour que je vous les envoie",
    "Autres_etudiants": [],
    "Formulaire_usager": "4",
    "Type_de_RDV": "Grand public",
    "Lieu_RDV_2": "Palais - Commissions",
    "Creneau_RDV_2": "2025-11-06T18:00:00.000Z",
    "Avocats_presents": null,
    "Motif_du_RDV": "Aide relecture statuts d'une SEL",
    "Origine": "",
    "Pieces_jointes_patient": null,
    "Lieu_RDV_1": "Palais - Commissions",
    "Creneau_RDV_1": "2025-10-23T17:00:00.000Z"
  },
  {
    "id": 8,
    "Patient": "Patient_008",
    "Statut": "Second rendez-vous",
    "Mail_patient": "patient008@example.com",
    "Telephone_patient": "",
    "Visioconference": false,
    "Etudiants_option": {
      "name": "InvalidTypedValue",
      "message": "RefList",
      "details": "Etudiant_003, Etudiant_004, Etudiant_005"
    },
    "Commentaires": "",
    "Autres_etudiants": {
      "name": "InvalidTypedValue",
      "message": "RefList",
      "details": "Etudiant_006"
    },
    "Formulaire_usager": "2",
    "Type_de_RDV": "Etudiants",
    "Lieu_RDV_2": "Manufacture - 119",
    "Creneau_RDV_2": "2025-10-21T16:00:00.000Z",
    "Avocats_presents": null,
    "Motif_du_RDV": "Litige avec bailleur",
    "Origine": "Formulaire web",
    "Pieces_jointes_patient": null,
    "Lieu_RDV_1": "Manufacture - 119",
    "Creneau_RDV_1": "2025-10-07T16:00:00.000Z"
  }
]


const calendar = createCalendar([], []);

const buildGristColumns = () => {
    const columns = [
        TITRE_NAME_COLUMN,
    ];
    CRENEAUX_RDV.forEach(creneau => {
        console.log('Ajout des colonnes pour le créneau :', creneau);
        for (const [_, value] of Object.entries(creneau.cols)) {
            columns.push(value);
        }
    });
    console.log('Colonnes Grist construites :', columns);
    return columns;
}

grist.ready({
    requiredAccess: 'read table',
    columns: buildGristColumns()
});

grist.onRecords((records) => {
    console.log('onRecords triggered');
    console.log('Records in the table:', records);

    if (records.length > 0) {
        editCalendar(calendar, getEventsInfos(records), getResources(records));
    }
    else {
        console.log('Pas d\'événements à afficher dans le calendrier.');
    }
});



function getResources(records){
    const resources = [];
    records.forEach(element => {
        CRENEAUX_RDV.forEach(creneau => {
            const lieu = element[creneau.cols.lieu.name];
            if(lieu && !resources.find(r => r.id === lieu)){
                resources.push({ id: lieu, title: lieu });
            }
        })
    });

    console.log('Ressources trouvées :', resources);
    return resources;
}

function isValidDate(value) {
   return value instanceof Date && !isNaN(value.getTime());
}

function getEventsInfos(records){
    const events = [];
    CRENEAUX_RDV.forEach(creneau => {
       records.forEach(dossier => {
        if(!isValidDate(dossier[creneau.cols.date.name])){
            console.log(`Date invalide pour le dossier ID ${dossier['id']} et le créneau ${creneau.cols.date.title} :`, dossier[creneau.cols.date.name]);
            return ;
        }

        events.push({
            title: `${dossier['Patient']}`,
            start: new Date(dossier[creneau.cols.date.name]),
            end: new Date(new Date(dossier[creneau.cols.date.name]).getTime() + (DUREE_RDV_DEFAULT.minutes * 60000)),
            resourceIds: [dossier[creneau.cols.lieu.name]],
            allDay: false,
            backgroundColor: creneau.backgroundColor,
            textColor: '#000000',
            editable: false,
            startEditable: false,
            durationEditable: false,
            extendedProps: {
                ordre: creneau.ordre,
            }

        })

       })
    });

    console.log('Événements trouvés :', events);
    return events;
}



function createCalendar(events, resources){
    const calendarEl = document.getElementById(CALENDAR_ID);
    const calendar = EventCalendar.create(calendarEl, {
        hiddenDays: [6,0],

        buttonText: {
            today: 'Aujourd’hui',
            prev: '‹ Précédent',
            next: 'Suivant ›',
            timeGridWeek: 'Vue Semaine',
            timeGridDay: 'Vue Jour',
            dayGridMonth: 'Vue Mois',
            resourceTimeGridDay: 'Vue par salle',
        },


        headerToolbar: {
            start: 'prev,next today',
            center: 'title',
            end: 'dayGridMonth,timeGridWeek,timeGridDay,resourceTimeGridDay'
        },


        view: 'dayGridMonth', 
        resources: resources,
        events: events,
        editable: false,
        selectable: false,

        eventContent: (eventInfo)=>{
            return {
            html: `
                <div style='font-size: 0.9em; overflow: hidden;' title='${eventInfo.event.title}'>
                    <i>${eventInfo.timeText}</i> - ${CHRONOLOGIE.find(c => c.ordre === eventInfo.event.extendedProps.ordre).emoji} <b>${eventInfo.event.title}</b>
                </div>
            `
        };
        },
    
        firstDay: 1,  
        slotDuration: DUREE_RDV_DEFAULT, 
        height: '100%',
        displayEventEnd: true,
        slotEventOverlap: false, // Permet le chevauchement des événements dans les créneaux horaires

        validRange: {
            start: new Date('2025-09-01'),
            end: new Date('2026-05-31')
        }
    });

    return calendar;
}

function editCalendar(calendar, events, ressources){
    // Fonctionnalité d'édition du calendrier à implémenter
    console.log('editCalendar called with events:', events, 'and resources:', ressources);
    calendar.setOption('events', events);
    calendar.setOption('resources', ressources);
    return calendar;
}