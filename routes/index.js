const debug = require('debug')('routes:index');
const express = require('express');
const router = express.Router();
const uuid = require('uuid/v4');

const storage = require(`${__dirname}/../bin/lib/storage`);
const database = require(`${__dirname}/../bin/lib/database`);
const analyse = require(`${__dirname}/../bin/lib/analyse`);

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
                                                                }, 150 * idx);
    
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
                            .then(function(data){
                                debug('Done.');
                                debug(data);
                            })
                        ;
                        

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

module.exports = router;
