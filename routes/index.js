const debug = require('debug')('routes:index');
const express = require('express');
const router = express.Router();
const uuid = require('uuid/v4');

const storage = require(`${__dirname}/../bin/lib/storage`);
const database = require(`${__dirname}/../bin/lib/database`);

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

router.get('/analyse', function(req, res, next) {

    storage.list()
        .then(data => {
            debug(data.Contents);
            res.render('analyse', { 
                title: 'Express',
                item : data.Contents
            });
        })
    ;

});

router.post('/analyse/:OBJECT_NAME', (req, res, next) => {

    const objectName = req.params.OBJECT_NAME;

    storage.check(objectName)
        .then(exists => {
            if(exists){
                database.get()
            }
        })
    ;

    res.end();

});

module.exports = router;
