grist.ready({
    requiredAccess: 'read table'
});

grist.onRecords((records) => {
    console.log('Records in the table:', records);
});
