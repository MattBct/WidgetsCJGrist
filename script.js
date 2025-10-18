const CALENDAR_ID = 'calendar'
const COLONNES_LIEUX = [
    "Lieu_RDV_1",
    "Lieu_RDV_2",
]

grist.ready({
    requiredAccess: 'read table'
});

grist.onRecords((records) => {
    console.log('Records in the table:', records);

    if (records.length > 0) {
        createCalendar([], getResources(records));
    }
    else {
        console.log('Pas d\'événements à afficher dans le calendrier.');
        createCalendar([], []);
    }
});

function getResources(records){
    const resources = [];
    records.forEach(element => {
        COLONNES_LIEUX.forEach(colonne => {
            const lieu = element[colonne];
            if(lieu && !resources.find(r => r === lieu)){
                resources.push(lieu);
            }
        })
    });
    return resources;
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
            dayGridMonth: 'Vue Mois'
        },


        headerToolbar: {
            start: 'prev,next today',
            center: 'title',
            end: 'dayGridMonth,timeGridWeek,timeGridDay,resourceTimeGridDay'
        },


        view: 'dayGridMonth', 
        resources: resources,
        events: events,
        
        firstDay: 1,  
        slotDuration: '01:00', 
        displayEventEnd: true,
        slotEventOverlap: false, // Permet le chevauchement des événements dans les créneaux horaires

        validRange: {
            start: new Date('2025-09-01'),
            end: new Date('2026-05-31')
        }
    });
}