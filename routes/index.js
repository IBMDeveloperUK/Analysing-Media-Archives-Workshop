const debug = require('debug')('routes:index');
const express = require('express');
const router = express.Router();
const uuid = require('uuid/v4');
const convertSeconds = require('convert-seconds')

// These are some modules I've put together to make interfacing
// with Watson services, Cloud object storage, and Cloudant Database
// a little bit easier. Feel free to root around inside them.
const storage = require(`${__dirname}/../bin/lib/storage`);
const database = require(`${__dirname}/../bin/lib/database`);
const analyse = require(`${__dirname}/../bin/lib/analyse`);

// We're using the lite tier of Cloudant DB in the IBM Cloud for this
// workshop, so we're throttling the number of requests we can make per 
// second so we don't miss anything out.
const DATABASE_THROTTLE_TIME = 200;

router.get('/', function(req, res, next) {
    res.render('index', { title: 'Media Archive Analyser' });
});

router.get('/analyse', function(req, res, next) {
    // GET ANALYSE ROUTE
    res.end();
});

router.post('/analyse/:OBJECT_NAME', (req, res, next) => {
    
    // POST ANALYSE ROUTE
    res.end()

});

router.post('/search', (req, res, next) => {
    
    // GET SEARCH ROUTE
    res.end();

});

router.get('/check/:OBJECT_NAME', (req, res, next) => {

    // A convenience endpoint used by the client-side code in /analyse
    // to check the analysis state of any media object.
    database.query({
            "selector" : {
                "name" : {
                    "$eq" : req.params.OBJECT_NAME
                },
            }
        }, 'index')
        .then(documents => {
            res.json({
                status : "ok",
                data : documents[0].analysing
            });
        })
    ;

});

router.get('/keyframe/:ObjectKey', (req, res, next) => {
    
    // Handy little function to expose the keyframes to the client
    storage.getStream(req.params.ObjectKey, 'cos-frames').pipe(res);

});

module.exports = router;
