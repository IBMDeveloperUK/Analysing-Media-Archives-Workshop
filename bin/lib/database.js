const debug = require('debug')('bin:lib:database');
const Cloudant = require('cloudant');

var cloudant = Cloudant({
    account : process.env.DATABASE_USERNAME,
    password : process.env.DATABASE_PASSWORD,
    url: process.env.DATABASE_ENDPOINT
});

//Edit this variable value to change name of database.
const DEFAULT_DB_NAME = process.env.DEFAULT_DB_NAME;

function queryTheDatabaseForADcoumentOrDocuments(token, params, database = DEFAULT_DB_NAME){
    const db = cloudant.db.use(database);

    return new Promise( (resolve, reject) => {

        db.find( params, (err, result) => {
            if(err){
                debug('Database err: (query)', err);
                reject(err);
            } else {
                resolve(result.docs)
            }
        });

    });
}

function updateAnItemInTheDatabase(document, database = DEFAULT_DB_NAME){
    const db = cloudant.db.use(database);

    return new Promise( (resolve, reject) => {

        db.insert(document, (err, result) => {
            if(err){
                debug('Database err (update):', err);
                reject(err);
            } else {
                resolve(result);
            }
        });

    });

}

function removeADocumentFromTheDatabase(documentID, documentRevision, database = DEFAULT_DB_NAME){
    
    const db = cloudant.db.use(database);
    
    return new Promise( (resolve, reject) => {

        db.destroy(docUniqueId, docRevNum, function(err, body, header) {
            
            if(err){
                debug('Database err (remove):', err);
                reject(err);
            } else {
                resolve();
            }
            
        });

    });

}

module.exports = {
    query : getANumberOfItemsFromTheDatabase,
    add : updateAnItemInTheDatabase,
    update : updateAnItemInTheDatabase,
    delete : removeADocumentFromTheDatabase
};