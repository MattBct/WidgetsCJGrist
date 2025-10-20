export const EMAILS = [
    {
        id: 1,
        expirationTime: true,
        statusMatch: "Premier rendez-vous",
        label: "Email Modèle 1",
        objet: "Objet de l'email 1",
        body: (nomPatient, datetimeRDV_1, lieuRDV_1, datetimeRDV_2, lieuRDV_2)=> {return 
            `<p>Bonjour ${nomPatient},</p>
            <p>Merci d'avoir pris rendez-vous avec la Clinique juridique de la Faculté de Droit de l'Université Jean Moulin Lyon 3.</p>
            <p>Nous vous rappelons que la Clinique juridique <strong>ne peut pas intervenir si vous êtes déjà suivi par un professionnel du droit</strong> (avocat, notaire, etc.).</p>

            <div class='mt-3'>
                <p>Nous pouvons vous proposer un rendez-vous le ${datetimeRDV_1.date} à ${datetimeRDV_1.time}. Ce premier rendez-vous vous permettra d'exposer votre situation et vos questions.</p>
                <p>Le lieu de ce premier rendez-vous est : ${lieuRDV_1}.</p>
            </div>

            <div class='mt-3'>
                <p>Les cliniciens vous restitueront leur travail au cours d'un second rendez-vous le ${datetimeRDV_2.date} à ${datetimeRDV_2.time}.</p>
                <p>Le lieu de ce second rendez-vous est : ${lieuRDV_2}.</p>
            </div>

            <p>
                <mark>Merci de nous confirmer que ces créneaux vous conviennent par retour de mail. Ces propositions de rendez-vous sont valides jusqu'au ${datetimeRDV_2.date} à ${datetimeRDV_2.time}. Au-delà, ceux-ci seront attribués à d'autres patients.</mark>
            </p>
            <p>Si ce rendez-vous ne vous convient pas, n'hésitez pas à nous contacter par retour de mail pour convenir d'autres créneaux.</p>
            <p>Si vous ne pouvez pas vous présenter à ce rendez-vous, merci de nous en informer au plus vite par retour de mail. </p>
            <p>Pour transmettre des documents relatifs à votre situation en amont de votre rendez-vous, n'hésitez pas à nous les transmettre par retour de courriel.
            Nous restons bien sûr à votre entière disposition pour toute question ou information complémentaire.
            </p>
            
            <div class='mt-3'>
                <p>Bien cordialement,</p>
                <p>La Clinique juridique de la Faculté de Droit de l'Université Jean Moulin Lyon 3</p>
            </div>
            `}
            },
]