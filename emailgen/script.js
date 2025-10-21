/*
TODO:
- Tester le copier coller
- Générer le lien d'envoi
- Styliser l'objet
- Styliser le contenu
- Développer un nouveau modèle d'email
*/


const CONTENT_ID = "content";
const SELECT_EMAIL_ID = "select-email";
const EXPIRATION_DATE_ID = "expiration-date";
const EXPIRATION_TIME_ID = "expiration-time";
const BTN_COPY_ID = "copyEmailBtn";

const EXPIRATION_DELTA_DAYS = 3;


const CRENEAUX_RDV_RELANCE = [
    {
        id: 1,
        label: "RDV 1",
        columnDateTimeName: "datetimeRDV_1",
        columnLieuName: "lieuRDV_1",
    },
    {
        id: 2,
        label: "RDV 2",
        columnDateTimeName: "datetimeRDV_2",
        columnLieuName: "lieuRDV_2",
    }
]

const GRIST_COLUMNS = [{
    name: "nomPatient",
    title: "Nom du patient",
    type: "Text",
}, 

{
    name: "email",
    title: "Email du patient",
    type: "Text",
    description: "Utilisé pour générer le lien vers l'envoi d'email"
},

{
    name: "datetimeRDV_1",
    title: "Date et heure du rendez-vous 1",
    type: "DateTime",
    description: "Utilisé pour remplir le contenu de l'email et ajuster la date de l'expiration",
}, {
    name: "lieuRDV_1",
    title: "Lieu du rendez-vous 1",
    type: "Choice",
    description: "Utilisé pour remplir le contenu de l'email",
}, {
    name: "datetimeRDV_2",
    title: "Date et heure du rendez-vous 2",
    type: "DateTime",
    description: "Utilisé pour remplir le contenu de l'email",
}, {
    name: "lieuRDV_2",
    title: "Lieu du rendez-vous 2",
    type: "Choice",
    label: "Lieu du rendez-vous 2",
    description: "Utilisé pour remplir le contenu de l'email",
}]

const findCreneauRDVIndex = (id)=> CRENEAUX_RDV_RELANCE.findIndex(creneauRDV => creneauRDV.id === id) ;

const rappelEmailContent = (record, creneauRDVIndex) => {
    const dateColumn = CRENEAUX_RDV_RELANCE[creneauRDVIndex].columnDateTimeName;
    const lieuColumn = CRENEAUX_RDV_RELANCE[creneauRDVIndex].columnLieuName;
    return `<p>Bonjour ${record.nomPatient},</p>
            <p>Nous nous permettons de vous écrire afin de vous rappeler que vous avez un rendez-vous le : <br/>
            
            <strong>${record[dateColumn].date} à ${record[dateColumn].time} au ${record[lieuColumn]}</strong> 
            <br/> dans le cadre de votre suivi par la Clinique juridique de la Faculté de Droit de l'Université Jean Moulin Lyon 3.</p>
            
            <mark>Si vous ne pouvez pas vous présenter à ce rendez-vous, merci de nous en informer au plus vite par retour de mail. </mark>
            
            <p>Nous restons bien sûr à votre entière disposition pour toute question ou information complémentaire.</p>
            </p>
            
            <div style='margin-top: 2rem;'>
                <p>Bien cordialement,</p>
                <p>La Clinique juridique de la Faculté de Droit de l'Université Jean Moulin Lyon 3</p>
            </div>
            `}

const rappelEmailSubject = (record, creneauRDVIndex)=> {
    const dateTimeColumn = CRENEAUX_RDV_RELANCE[creneauRDVIndex].columnDateTimeName;
    return `Rappel de votre rendez-vous ${record[dateTimeColumn].date} ${record[dateTimeColumn].time} - Clinique Juridique`
}

const EMAILS = [
    {
        id: 1,
        expirationTime: true,
        statusMatch: "Premier rendez-vous",
        label: "Proposition de RDV",
        objet: (record)=> "Proposition de créneaux de RDV - Clinique Juridique",
        body: (record)=> {
            return (
            `<p>Bonjour ${record.nomPatient},</p>
            <p>Merci d'avoir pris rendez-vous avec la Clinique juridique de la Faculté de Droit de l'Université Jean Moulin Lyon 3.</p>
            <p>Nous vous rappelons que la Clinique juridique <strong>ne peut pas intervenir si vous êtes déjà suivi par un professionnel du droit</strong> (avocat, notaire, etc.).</p>

            <div style='margin-top: 2.5rem; font-weight: bold;'>
                <div style='margin-top: 1rem;'>
                    <p>Nous pouvons vous proposer un rendez-vous le <strong class='dateMail'>${record.datetimeRDV_1.date} à ${record.datetimeRDV_1.time}</strong>. Ce premier rendez-vous vous permettra d'exposer votre situation et vos questions.</p>
                    <p>Le lieu de ce premier rendez-vous est : ${record.lieuRDV_1}.</p>
                </div>

                <div style='margin-top: 1rem;'>
                    <p>Les cliniciens vous restitueront leur travail au cours d'un second rendez-vous le <strong class='dateMail'>${record.datetimeRDV_2.date} à ${record.datetimeRDV_2.time}</strong>.</p>
                    <p>Le lieu de ce second rendez-vous est : ${record.lieuRDV_2}.</p>
                </div>
            </div>
            

            <p style='font-weight: bold;'>
                <mark>Merci de nous confirmer que ces créneaux vous conviennent par retour de mail. Ces propositions de rendez-vous sont valides jusqu'au ${record.expiration_datetime.date} à ${record.expiration_datetime.time}. Au-delà, ceux-ci seront attribués à d'autres patients.</mark>
            </p>
            <p>Si ces rendez-vous ne vous conviennent pas, n'hésitez pas à nous contacter par retour de mail pour convenir d'autres créneaux.</p>
            <p>Si vous ne pouvez pas vous présenter à ce rendez-vous, merci de nous en informer au plus vite par retour de mail. </p>
            <p>Pour transmettre des documents relatifs à votre situation en amont de votre rendez-vous, n'hésitez pas à nous les transmettre par retour de courriel.</p>
            <p>Nous restons bien sûr à votre entière disposition pour toute question ou information complémentaire.</p>
            </p>
            
            <div style='margin-top: 2rem;'>
                <p>Bien cordialement,</p>
                <p>La Clinique juridique de la Faculté de Droit de l'Université Jean Moulin Lyon 3</p>
            </div>
            `)}
        },
        
        {
        id: 2,
        expirationTime: true,
        statusMatch: "Premier rendez-vous",
        label: "Relance premier rendez-vous",
        objet: (record)=> rappelEmailSubject(record, findCreneauRDVIndex(1)),
        body: (record)=> rappelEmailContent(record, findCreneauRDVIndex(1)),
        },
        {
        id: 3,
        expirationTime: true,
        statusMatch: "Premier rendez-vous",
        label: "Relance second rendez-vous",
        objet: (record)=> rappelEmailSubject(record, findCreneauRDVIndex(2)),
        body: (record)=> rappelEmailContent(record, findCreneauRDVIndex(2)),
        },

            
]

let activeRecord = null;


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

        return new DateTimeObject(obj.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), obj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    }
    
}


function handleSelectEmailChange(event) {
    resetError();
    try {
        const selectedEmailId = parseInt(event.target.value);
        const selectedEmailIndex = EMAILS.findIndex(email => email.id === selectedEmailId);
    
        if (selectedEmailIndex !== -1) {
            renderEmailPreview(activeRecord, selectedEmailIndex);
            document.getElementById(EXPIRATION_TIME_ID).disabled = !EMAILS[selectedEmailIndex].expirationTime;
            document.getElementById(EXPIRATION_DATE_ID).disabled = !EMAILS[selectedEmailIndex].expirationTime;
        }
    }

    catch (error) {
        const err = "Une erreur s'est produite lors de la mise à jour du template d'email";
        displayError(err);
        console.error(err);
    }
    
}

function isValidDate(value) {
   return value instanceof Date && !isNaN(value.getTime());
}

function setDefaultExpirationTime(rdvDate=null) {
    let now = new Date()
    if(rdvDate && isValidDate(rdvDate)){
        now = rdvDate;
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

    document.getElementById(BTN_COPY_ID).addEventListener("click", handleCopy);
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

function handleRecordChange(datetime_RDV1) {
    //Set le max de la date + déclenche un handleselect
    const dateSelect = document.getElementById(EXPIRATION_DATE_ID);
    dateSelect.max = datetime_RDV1.toISOString().split('T')[0];
    setDefaultExpirationTime(datetime_RDV1);

    const selectEmail = document.getElementById(SELECT_EMAIL_ID);  
    handleSelectEmailChange({target: selectEmail});
}

function renderEmailPreview(record, index) {
    //Génère l'email
    const contentDiv = document.getElementById(CONTENT_ID);

    
    contentDiv.innerHTML = EMAILS[index].body(
        {...record, expiration_datetime: getExpirationDateTime()}
    );
}




grist.ready(
    {
        requiredAccess: 'read table',
        columns: GRIST_COLUMNS
    }
);
grist.onRecord(function(record, mappings) {
    resetError();
    let mappedRecord = grist.mapColumnNames(record) 
    console.log("Mapped record", mappedRecord)
    if(isValidDate(mappedRecord.datetimeRDV_1) === false || isValidDate(mappedRecord.datetimeRDV_2) === false){
        const error = "Dates invalide sur le RDV sélectionné";
        displayError(error);
        console.error(error);
        return
    }
    else {
        mappedRecord.datetimeRDV_1_dt = structuredClone(mappedRecord.datetimeRDV_1);
        mappedRecord.datetimeRDV_1 = DateTimeObject.fromObjectDT(mappedRecord.datetimeRDV_1);
        mappedRecord.datetimeRDV_2 = DateTimeObject.fromObjectDT(mappedRecord.datetimeRDV_2);
    }

    if(mappedRecord.lieuRDV_1 === '' || mappedRecord.lieuRDV_2 === ''){
        const error = "Lieu vide sur le RDV sélectionné";
        displayError(error);
        console.error(error);
        return
    }

    activeRecord = mappedRecord;
    try {
        handleRecordChange(mappedRecord.datetimeRDV_1_dt);
    }
    catch (error) {
        displayError(error);
        console.error(error);
    }
});

  
const displayError = (message) => {
    document.getElementById(CONTENT_ID).innerHTML = `
<div class="alert alert-error" role="alert">
  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <span>Erreur sur la ligne de RDV sélectionnée : ${message}</span>
</div>`;
}

const resetError = () => {
    document.getElementById(CONTENT_ID).innerHTML = "";
}

function handleCopy(event) {
    const html_content = document.getElementById(CONTENT_ID).innerHTML;
    const text_content = document.getElementById(CONTENT_ID).textContent;
    const blobHTML = new Blob([html_content], { type: 'text/html' });
    const blobText = new Blob([text_content], { type: 'text/plain' });
    const item = new ClipboardItem({
        'text/html': blobHTML,
        'text/plain': blobText
    });
    navigator.clipboard.write([item]);
}

/*const sampleData = {
    Patient: "John Doe",
    datetimeRDV_1: new Date("2005-10-20T10:30:00"),
    lieuRDV_1: "Lieu 1",
    datetimeRDV_2: new Date("2005-10-27T10:30:00"),
    lieuRDV_2: "Lieu 2",
};*/

onLoadPage();
