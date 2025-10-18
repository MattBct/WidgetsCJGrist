grist.ready({
    requiredAccess: 'read table'
});

grist.onRecords((records) => {
    document.getElementById('test').innerHTML = records;
});


