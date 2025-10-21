const CONTENT_ID = "content";
const SELECT_EMAIL_ID = "select-email";
const EXPIRATION_DATE_ID = "expiration-date";
const EXPIRATION_TIME_ID = "expiration-time";
const EXPIRATION_DELTA_DAYS = 3;

const EMAILS = [
    {
        id: 1,
        expirationTime: true,
        statusMatch: "Premier rendez-vous",
        label: "Email Modèle 1",
        objet: "Objet de l'email 1",
        body: (nomPatient, datetimeRDV_1, lieuRDV_1, datetimeRDV_2, lieuRDV_2, expiration_datetime)=> {
            return (
            `<p>Bonjour ${nomPatient},</p>
            <p>Merci d'avoir pris rendez-vous avec la Clinique juridique de la Faculté de Droit de l'Université Jean Moulin Lyon 3.</p>
            <p>Nous vous rappelons que la Clinique juridique <strong>ne peut pas intervenir si vous êtes déjà suivi par un professionnel du droit</strong> (avocat, notaire, etc.).</p>

            <div class='my-6 font-bold'>
                <div class='mt-3'>
                    <p>Nous pouvons vous proposer un rendez-vous le <strong class='dateMail'>${datetimeRDV_1.date} à ${datetimeRDV_1.time}</strong>. Ce premier rendez-vous vous permettra d'exposer votre situation et vos questions.</p>
                    <p>Le lieu de ce premier rendez-vous est : ${lieuRDV_1}.</p>
                </div>

                <div class='mt-3'>
                    <p>Les cliniciens vous restitueront leur travail au cours d'un second rendez-vous le <strong class='dateMail'>${datetimeRDV_2.date} à ${datetimeRDV_2.time}</strong>.</p>
                    <p>Le lieu de ce second rendez-vous est : ${lieuRDV_2}.</p>
                </div>
            </div>
            

            <p class='font-bold'>
                <mark>Merci de nous confirmer que ces créneaux vous conviennent par retour de mail. Ces propositions de rendez-vous sont valides jusqu'au ${expiration_datetime.date} à ${expiration_datetime.time}. Au-delà, ceux-ci seront attribués à d'autres patients.</mark>
            </p>
            <p>Si ces rendez-vous ne vous conviennent pas, n'hésitez pas à nous contacter par retour de mail pour convenir d'autres créneaux.</p>
            <p>Si vous ne pouvez pas vous présenter à ce rendez-vous, merci de nous en informer au plus vite par retour de mail. </p>
            <p>Pour transmettre des documents relatifs à votre situation en amont de votre rendez-vous, n'hésitez pas à nous les transmettre par retour de courriel.</p>
            <p>Nous restons bien sûr à votre entière disposition pour toute question ou information complémentaire.</p>
            </p>
            
            <div class='mt-3'>
                <p>Bien cordialement,</p>
                <p>La Clinique juridique de la Faculté de Droit de l'Université Jean Moulin Lyon 3</p>
            </div>
            `)}
            },
]

class DateTimeObject {
    constructor(date = new Date(), time = "string") {
        this.date = date;
        this.time = time;
    }

    static fromObjectDT(obj) {
        if(isValidDate(obj) === false){
            console.error("Invalid date object passed to fromObjectDT");
            return new DateTimeObject("Erreur de date", "Erreur de temps");
        }

        return new DateTimeObject(obj.toLocaleDateString('fr-FR'), obj.toLocaleTimeString('fr-FR'));
    }
    
}


function handleSelectEmailChange(event) {
    const selectedEmailId = parseInt(event.target.value);
    const selectedEmailIndex = EMAILS.findIndex(email => email.id === selectedEmailId);
    document.getElementById(EXPIRATION_TIME_ID).disabled = !EMAILS[selectedEmailIndex].expirationTime;
    document.getElementById(EXPIRATION_DATE_ID).disabled = !EMAILS[selectedEmailIndex].expirationTime;
    if (selectedEmailIndex !== -1) {
        renderEmailPreview(activeRecord, selectedEmailIndex);
    }
}

function isValidDate(value) {
   return value instanceof Date && !isNaN(value.getTime());
}

function setDefaultExpirationTime(rdvDate=null) {
    const now = new Date()
    if(rdvDate && isValidDate(rdvDate)){
        now.setDate(rdvDate)
    }
    else{
        now.setDate(now.getDate() + EXPIRATION_DELTA_DAYS);
    }
    const defaultDate = now.toISOString().split('T')[0];
    const defaultTime = "17:00";

    document.getElementById(EXPIRATION_DATE_ID).value = defaultDate;
    document.getElementById(EXPIRATION_TIME_ID).value = defaultTime;
}

function getExpirationDateTime() {
    let dateValue = document.getElementById(EXPIRATION_DATE_ID).value;
    if(dateValue)(
        dateValue = new Date(dateValue).toLocaleDateString('fr-FR')
    )
    else{
        dateValue = "Erreur de date";
        console.error("Date d'expiration non définie");
    }
    const timeValue = document.getElementById(EXPIRATION_TIME_ID).value;
    return new DateTimeObject(dateValue, timeValue);
}

function eventsOnChange() {
    document.getElementById(SELECT_EMAIL_ID).addEventListener("change", handleSelectEmailChange);
    document.getElementById(EXPIRATION_DATE_ID).addEventListener("change", () => {
        const selectEmail = document.getElementById(SELECT_EMAIL_ID);
        handleSelectEmailChange({target: selectEmail});
    });
    document.getElementById(EXPIRATION_TIME_ID).addEventListener("change", () => {
        const selectEmail = document.getElementById(SELECT_EMAIL_ID);
        handleSelectEmailChange({target: selectEmail});
    });
}
function onLoadPage() {
    const selectEmail = document.getElementById(SELECT_EMAIL_ID);
    EMAILS.forEach(email => {
        const option = document.createElement("option");
        option.value = email.id;
        option.text = email.label;
        selectEmail.appendChild(option);
    });

    setDefaultExpirationTime();
    eventsOnChange();

}

function handleRecordChange(newRecord) {
    //Set le max de la date + déclenche un handleselect
    const dateSelect = document.getElementById(EXPIRATION_DATE_ID);
    dateSelect.max = newRecord.datetimeRDV_1.toISOString().split('T')[0];
    setDefaultExpirationTime(newRecord.datetimeRDV_1);

    const selectEmail = document.getElementById(SELECT_EMAIL_ID);  
    handleSelectEmailChange({target: selectEmail});
}

function renderEmailPreview(record, index) {
    //Génère l'email
    const contentDiv = document.getElementById(CONTENT_ID);
    console.log(record, getExpirationDateTime());
    contentDiv.innerHTML = EMAILS[index].body(
        record.Patient,
        DateTimeObject.fromObjectDT(record.datetimeRDV_1),
        record.lieuRDV_1,
        DateTimeObject.fromObjectDT(record.datetimeRDV_2),
        record.lieuRDV_2,
        getExpirationDateTime()
    );
}

let activeRecord = null;
const GRIST_COLUMNS = [{
    name: "Patient",
    title: "Nom du patient",
    type: "Text",
}, {
    name: "datetimeRDV_1",
    title: "Date et heure du rendez-vous 1",
    type: "DateTime",
}, {
    name: "lieuRDV_1",
    title: "Lieu du rendez-vous 1",
    type: "Text",
}, {
    name: "datetimeRDV_2",
    title: "Date et heure du rendez-vous 2",
    type: "DateTime",
}, {
    name: "lieuRDV_2",
    title: "Lieu du rendez-vous 2",
    type: "Text",
    label: "Lieu du rendez-vous 2"
}]
grist.ready(
    {
        requiredAccess: 'read table',
        columns: GRIST_COLUMNS
    }
);
grist.onRecord(function(record, mappings) {
    const mappedRecord = grist.mapColumnNames(record) 
    console.log("Mapped record", mappedRecord)
    if(isValidDate(mappedRecord.datetimeRDV_1) === false || isValidDate(mappedRecord.datetimeRDV_2) === false){
        const error = "Dates invalide sur le RDV sélectionné";
        displayError(error);
        console.error(error);
        return
    }

    if(mappedRecord.lieuRDV_1 === '' || mappedRecord.lieuRDV_2 === ''){
        const error = "Lieu vide sur le RDV sélectionné";
        displayError(error);
        console.error(error);
        return
    }

    handleRecordChange(mappedRecord);
    activeRecord = mappedRecord;
});

onLoadPage();
  
const displayError = (message) => {
    document.getElementById(CONTENT_ID).innerHTML = `<div>Erreur sur le RDV sélectionné : ${message}</div>`;
}

const sampleData = {
    Patient: "John Doe",
    datetimeRDV_1: new Date("2005-10-20T10:30:00"),
    lieuRDV_1: "Lieu 1",
    datetimeRDV_2: new Date("2005-10-27T10:30:00"),
    lieuRDV_2: "Lieu 2",
};