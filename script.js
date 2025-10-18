grist.ready({
    requiredAccess: 'read table'
  });

grist.onRecords((records) => {
console.log(records);
});