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
    const mappedRecords = grist.mapColumnNames(records); 
    console.log('Mapped records in the table:', mappedRecords);


    if (mappedRecords.length > 0) {
        editCalendar(calendar, getEventsInfos(mappedRecords), getResources(mappedRecords));
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

        console.log(dossier);

        events.push({
            title: `${dossier[TITRE_NAME_COLUMN.name]}`,
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
                idDossier: dossier['id'],
            }

        })

       })
    });

    console.log('Événements trouvés :', events);
    return events;
}

function onEventClick(info){
    console.log('Event clicked:', info.event);
    const idDossier = info.event.extendedProps.idDossier;
    if(idDossier){
        grist.setCursorPos({
            rowId: idDossier
        });
    } else {
        console.warn('Aucun ID de dossier trouvé pour cet événement.');
    }
}


function createCalendar(events, resources){
    const calendarEl = document.getElementById(CALENDAR_ID);
    const calendar = EventCalendar.create(calendarEl, {
        hiddenDays: [6,0],
        eventClick: onEventClick,
        
        locale: 'fr',

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