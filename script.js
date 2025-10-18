const { createApp, ref } = Vue

createApp({
    setup() {
        const message = ref('')
        grist.ready({
            requiredAccess: 'read table'
        });

        grist.onRecords((records) => {
            message.value = records;
        });

        return {
            message
        }
    }
}).mount('#app')



