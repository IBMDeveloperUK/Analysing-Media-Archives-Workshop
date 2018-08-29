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
    storage.list()
        .then(data => {
            // CODE BLOCK 1
            database.query({
                    "selector": {
                        "$or": data.Contents.map(fileObject => { return {"name" : fileObject.Key} })
                    }
                }, 'index')
                .then(records => {
                    debug('OBJS:', records);
                    // CODE BLOCK 2
                    return database.query({
                            "selector" : {
                                "$or" : records.map(record => { return { "parent" : record.uuid } })
                            },
                        }, 'transcripts')
                        .then(transcripts => { 
                            // CODE BLOCK 3
                            
                            const itemInfo = data.Contents.map(item => {

                                const databaseEntry = records.filter(record => {
                                    debug('RECORD:', record, 'ITEM:', item);
                                    return record.name === item.Key
                                })[0];

                                debug(databaseEntry);
                                
                                return {
                                    Key : item.Key,
                                    exists : databaseEntry !== undefined,
                                    transcribed: databaseEntry !== undefined ? transcripts.filter(transcript => transcript.parent === databaseEntry.uuid)[0] !== undefined : false,
                                    analysing: databaseEntry !== undefined ? databaseEntry.analysing.frames || databaseEntry.analysing.audio : false
                                };
                                
                            });

                            res.render('analyse', { 
                                title: 'Media Archiver Analyser',
                                item : itemInfo
                            });

                        })    
                    ;

                })
            ;

        })
    ;
});

router.post('/analyse/:OBJECT_NAME', (req, res, next) => {
    // POST ANALYSE ROUTE
    res.end();
});

router.post('/search', (req, res, next) => {
    // GET SEARCH ROUTE
    res.end();
});

router.get('/check/:OBJECT_NAME', (req, res, next) => {
    // GET CHECK ROUTE
    res.end()
});

router.get('/keyframe/:ObjectKey', (req, res, next) => {
    // GET KEYFRAME ROUTE
    res.end();
});

module.exports = router;
