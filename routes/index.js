const debug = require('debug')('routes:index');
const express = require('express');
const router = express.Router();
const uuid = require('uuid/v4');

const storage = require(`${__dirname}/../bin/lib/storage`);
const database = require(`${__dirname}/../bin/lib/database`);
const analyse = require(`${__dirname}/../bin/lib/analyse`);

const DATABASE_THROTTLE_TIME = 200;

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Media Archive Analyser' });
});

router.get('/analyse', function(req, res, next) {

    storage.list()
        .then(data => {
            debug(data.Contents);

            database.query({
                    "selector": {
                        "$or": data.Contents.map(fileObject => { return {"name" : fileObject.Key} })
                    }
                }, 'index')
                .then(records => {
                    debug('OBJS:', records);

                    return database.query({
                            "selector" : {
                                "$or" : records.map(record => { return { "parent" : record.uuid } })
                            },
                        }, 'transcripts')
                        .then(transcripts => {

                            const itemInfo = data.Contents.map(item => {

                                const databaseEntry = records.filter(record => {
                                    debug('RECORD:', record, 'ITEM:', item);
                                    return record.name === item.Key
                                })[0];

                                debug(databaseEntry);
                                
                                return {
                                    Key : item.Key,
                                    exists : databaseEntry !== undefined,
                                     transcribed: databaseEntry !== undefined ? transcripts.filter(transcript => transcript.parent === databaseEntry.uuid)[0] !== undefined : false
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

    const objectName = req.params.OBJECT_NAME;

    debug(objectName);

    storage.check(objectName)
        .then(exists => {
            if(exists){
                
                database.query({
                        "selector": {
                            "name": {
                            "$eq": objectName
                            }
                        },
                    }, 'index')
                    .then(results => {

                        debug(results.length);
                        let document;

                        if(results.length === 0){

                            const objectUUID = uuid();
    
                            document = {
                                name : objectName,
                                uuid : objectUUID,
                                analysing : {
                                    frames : true,
                                    audio : true,
                                    text: true
                                }
                            };

                        } else {
                            document = results[0];
                            document.analysing = {
                                frames : true,
                                audio : true,
                                text: true
                            }
                        }

                        // Cleanup existing records
                        return Promise.all( [ database.query( { "selector": { "parent": { "$eq": document.uuid } } }, 'frames'), database.query( { "selector": { "parent": { "$eq": document.uuid } } }, 'transcripts') ],  )
                            .then(results => {
                                debug(results[0]);

                                const keyFramesToDelete = storage.deleteMany( results[0].map(document => { return { Key: `${document.uuid}.jpg` } }) );
                                const deleteKeyFrameRecordsAndTranscripts = new Promise( (resolve, reject) => {

                                    const deleteKeyframeRecordsActions = results[0].map( (document, idx) => {
                                        return new Promise( (resolve, reject) => {

                                            setTimeout(function(){
                                                database.delete(document._id, document._rev, 'frames')
                                                    .then(function(){
                                                        resolve();
                                                    })
                                                    .catch(err => reject(err))
                                            }, DATABASE_THROTTLE_TIME * idx);

                                        });
                                        
                                    });

                                    Promise.all(deleteKeyframeRecordsActions)
                                        .then(function(){

                                            const deleteTranscriptActions = results[1].map( (transcriptDocument, idx) => {

                                                return new Promise( (resolve, reject) => {

                                                    setTimeout(function(){
                                                        database.delete(transcriptDocument._id, transcriptDocument._rev, 'transcripts')
                                                            .then(function(){
                                                                resolve();
                                                            })
                                                            .catch(err => reject(err))
                                                    }, DATABASE_THROTTLE_TIME * idx);
        
                                                });

                                            } );

                                            return Promise.all(deleteTranscriptActions);

                                        })
                                        .then(function(){
                                            resolve();
                                        })
                                        .catch(err => {
                                            debug('Delete records err:', err);
                                            reject(err);
                                        })
                                    ;

                                });

                                return Promise.all( [ keyFramesToDelete, deleteKeyFrameRecordsAndTranscripts ] )

                            })
                            .then(function(){
                                debug('Clean up done');

                                return database.add(document, 'index')
                                    .then(function(){

                                        return storage.get(objectName)
                                            .then(data => {
                                                debug(data);

                                                // Tell the client that the good work is underway
                                                res.json({
                                                    status : "ok",
                                                    message : `Beginning analysis for '${objectName}'`
                                                });

                                                const analysis = [];

                                                const frameClassification = analyse.frames(data.Body)
                                                    .then(frames => {
                                                        debug(frames);

                                                        const S = frames.map( (frame, idx) => {

                                                            return new Promise( (resolve, reject) => {

                                                                const dataOperations = [];
                                                                
                                                                const frameData = Object.assign({}, frame);
                                                                
                                                                frameData.parent = document.uuid;
                                                                frameData.uuid = uuid();
                                                                delete frameData.image;
            
                                                                const saveFrame = storage.put(`${frameData.uuid}.jpg`, frame.image, 'cos-frames');
                                                                const saveClassifications = new Promise( (resolveA, reject) => {
                                                                    
                                                                    (function(frameData){
            
                                                                        setTimeout(function(){
                                                                            database.add(frameData, 'frames')
                                                                                .then(function(){
                                                                                    resolveA();
                                                                                })
                                                                            ;
                                                                        }, DATABASE_THROTTLE_TIME * idx);
            
                                                                    })(frameData);
                                                                    
                                                                });
            
                                                                dataOperations.push(saveFrame);
                                                                dataOperations.push(saveClassifications);
                                                                debug('dataOperations:', dataOperations);
            
                                                                Promise.all(dataOperations)
                                                                    .then(function(){
                                                                        resolve( frameData );
                                                                    })
                                                                ;

                                                            });

                                                        });

                                                        return Promise.all(S);

                                                    })
                                                ;

                                                analysis.push(frameClassification);
                                                
                                                const audioTranscription = analyse.audio(data.Body)
                                                    .then(transcriptionData => {
                                                        transcriptionData.uuid = uuid();
                                                        transcriptionData.parent = document.uuid;
                                                        return database.add(transcriptionData, 'transcripts')
                                                            .then(function(){
                                                                return transcriptionData;
                                                            })
                                                            .catch(err => {
                                                                debug('DB error (transcripts):', err);
                                                            })
                                                        ;
                                                    })
                                                    .catch(err => {
                                                        debug('Transcription err:', err);
                                                        debug(err);
                                                    })
                                                ;
                                                
                                                analysis.push(audioTranscription);

                                                return Promise.all(analysis);

                                            })
                                        ;
                                    })
                                ;

                            })
                            .catch(err => {
                                debug('Dependents error (keyframes)', err);
                            })
                        ;
                        
                    })
                    .then(function(data){
                        debug('All Done.');
                        debug(data);
                    })
                    .catch(err => {
                        debug('ERR:', err);
                    })
                ;

            } else {
                res.status(404);
                res.json({
                    status : 'err',
                    message : `An object with the name '${objectName}' was not found in the object storage`
                });
            }
        })
    ;

});

router.post('/search', (req, res, next) => {

    debug(req.body);

    const phrase = req.body.searchTerm;
    const tags = req.body.searchTerm.split(' ');

    debug(tags.map(tag => {return {'class' : tag}}));

    const queries = [];

    const keyframeSearch = database.query({
        "selector": {
            "analysis": {
                "$elemMatch": {
                    "$or": tags.map(tag => {return {'class' : tag}})
                }
            }
        }
    }, 'frames');

    const transcriptSearch = Promise.resolve([]);
    
    Promise.all( [ keyframeSearch, transcriptSearch ] )
        .then(searchResults => {
            debug(searchResults);
            res.json({
                status : "ok",
                message : "Data arrived.",
                data : searchResults[0]
            });
        })
        .catch(err => {
            debug('Search err:', err);
        })
    ;


});

module.exports = router;
