const debug = require('debug')('routes:index');
const express = require('express');
const router = express.Router();
const uuid = require('uuid/v4');
const convertSeconds = require('convert-seconds')

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

    // First up, we get a list of media files in our cloud object storage
    // so we can give our user a choice of what they want to analyse.
    storage.list()
        .then(data => {
            debug(data.Contents);
            
            // Then, we go to our Cloudant DB instance and check whether or
            // not we've ever analysed each media file in the past
            database.query({
                    "selector": {
                        "$or": data.Contents.map(fileObject => { return {"name" : fileObject.Key} })
                    }
                }, 'index')
                .then(records => {
                    debug('OBJS:', records);

                    // Finally we check whether or not we've ever transcribed the content of the media file
                    return database.query({
                            "selector" : {
                                "$or" : records.map(record => { return { "parent" : record.uuid } })
                            },
                        }, 'transcripts')
                        .then(transcripts => {

                            // Once we have the info on both the transcriptions and the info from our 
                            // index database, we put this all together so that we can render the 
                            // table on the /analyse page with the appropriate details.
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

    const objectName = req.params.OBJECT_NAME;
    debug(objectName);
    
    // Before we try to analyse anything, we want to make sure that the
    // file actually exists, so we do that first with storage.check();
    storage.check(objectName)
        .then(exists => {
            if(exists){
                
                // Once we know the file exists, we attempt to retrieve the corresponding
                // record (the 'document') from our database which keeps track of all
                // file analysed in the past, or currently being analysed.
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
                        
                        // If there's no document in our database, we've never analysed
                        // this file before. So, we'll give it a UUID and create a document
                        // that can store in our database to track the state of any
                        // analysis process.
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
                            // If there is already a record for this file, then we've analysed
                            // it before, but that's OK, we can still trigger a re-analysis of
                            // anything in our storage bucket.
                            document = results[0];
                            document.analysing = {
                                frames : true,
                                audio : true
                            }
                        }

                        // Before we analyse anything, we want to clean up any supporting files from past 
                        // analysis. This means deleting transcriptions and keyframes from previous analysis
                        // This database query will get us a list of all of the transcriptions and keyframes.
                        return Promise.all( [ database.query( { "selector": { "parent": { "$eq": document.uuid } } }, 'frames'), database.query( { "selector": { "parent": { "$eq": document.uuid } } }, 'transcripts') ]  )
                            .then(results => {
                                debug(results[0]);
                                
                                // First up, delete the keyframes from our object storage.
                                const keyFramesToDelete = storage.deleteMany( results[0].map(document => { return { Key: `${document.uuid}.jpg` } }) );
                                
                                // This command will delete all of the keyframe and transcript records from our database
                                const deleteKeyFrameRecordsAndTranscripts = new Promise( (resolve, reject) => {
                                    
                                    // Delete all of the keyframe records
                                    const deleteKeyframeRecordsActions = results[0].map( (document, idx) => {
                                        return new Promise( (resolve, reject) => {
                                            
                                            // Because we're using the IBM Cloud Lite tier for our workshop, we need
                                            // to throttle the number of requests being made to the database.
                                            // Normally, this process would be much faster and wouldn't need a 
                                            // setTimeout. If you're on a paid account, or have your own instance,
                                            // you can remove the setTimeout (or set DATABSE_THROTTLE_TIME to 0).
                                            setTimeout(function(){
                                                database.delete(document._id, document._rev, 'frames')
                                                    .then(function(){
                                                        resolve();
                                                    })
                                                    .catch(err => reject(err))
                                            }, DATABASE_THROTTLE_TIME * idx);

                                        });
                                        
                                    });

                                    // When all of the keyframe records have been deleted, delete the transcriptions too
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

                                // Wait until both the keyframes in our object storage, and the records of our 
                                // keyframes and transcripts in our database are deleted, and then move on to
                                // the next bit of code.
                                return Promise.all( [ keyFramesToDelete, deleteKeyFrameRecordsAndTranscripts ] )

                            })
                            .then(function(){
                                debug('Clean up done');
                                
                                // So we've cleaned up our database and object storage for analysis, now 
                                // it's time to start analysing!

                                // Here, we write a record to our 'index' database which we'll use to 
                                // keep track of the analysis process as it's worked through.
                                return database.add(document, 'index')
                                    .then(function(){

                                        // Now that we know that the media file exists, and that all previous
                                        // analysis have been cleaned up, we can grab the file from the object
                                        // storage for analysis.
                                        return storage.get(objectName)
                                            .then(data => {
                                                debug(data);

                                                // The client request that triggered our analysis is still waiting
                                                // for a response. Let's tell it that the analysis is underway.
                                                res.json({
                                                    status : "ok",
                                                    message : `Beginning analysis for '${objectName}'`
                                                });

                                                // We're going to be performing two analysis on this media file.
                                                // We're going to analyse the keyframes in the video file to ascertain what the video
                                                // contains, and we're going to analyse the audio to extract a transcription of
                                                // the video that we can use to search key terms that are spoken aloud. 
                                                const analysis = [];

                                                // Here, we trigger the keyframe analysis. The video object is passed to the 
                                                // analyse.frames function where it identifies the keyframes and sends off 
                                                // each identified frame to IBM Watson Visual Recognition for classification
                                                const frameClassification = analyse.frames(data.Body)
                                                    .then(frames => {
                                                        debug(frames);
                                                        
                                                        // Once each frame has been analysed, we'll iterate through each one and
                                                        // save it to our object storage (so we can display it later if needs be),
                                                        // and we'll save the classifications from Watson for use in our search engine
                                                        // later.
                                                        const S = frames.map( (frame, idx) => {

                                                            return new Promise( (resolve, reject) => {

                                                                const dataOperations = [];
                                                                
                                                                const frameData = Object.assign({}, frame);
                                                                
                                                                // The 'parent' property saves the UUID of the record of the media
                                                                // file that we added in the 'index' database so we can track which
                                                                // keyframes belong to which videos.
                                                                frameData.parent = document.uuid;
                                                                frameData.uuid = uuid();
                                                                delete frameData.image; // We don't want to store the image buffer in our database
            
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

                                                        // When every frame has been stored in object storage and recorded in
                                                        // our database, we'll update our original document in 'index' to 
                                                        // mark that we've finished analysing the keyframes of the video.
                                                        return Promise.all(S)
                                                            .then(function(){

                                                                return database.query({
                                                                        selector : {
                                                                            "uuid" : {
                                                                                "$eq" : document.uuid
                                                                            }
                                                                        }
                                                                    }, 'index')
                                                                    .then(results => {
                                                                        results[0].analysing.frames = false;
                                                                        return database.add(results[0], 'index');
                                                                    })
                                                                ;
                                                            });

                                                    })
                                                ;

                                                analysis.push(frameClassification);
                                                
                                                // Here, we pass the video file through to the analyse.audio()
                                                // function. This function will extract the audio from the video file
                                                // (it will also run it through a band pass filter that contains only
                                                // the frequencies that human voices operate in) and pass it on to
                                                // Watson Speech To Text for transcription
                                                const audioTranscription = analyse.audio(data.Body)
                                                    .then(transcriptionData => {
                                                        transcriptionData.uuid = uuid();
                                                        transcriptionData.parent = document.uuid;

                                                        // Once we have our transcription, we add it to our database.
                                                        return database.add(transcriptionData, 'transcripts')
                                                            .then(function(){
                                                                
                                                                return database.query({
                                                                        selector : {
                                                                            "uuid" : {
                                                                                "$eq" : document.uuid
                                                                            }
                                                                        }
                                                                    }, 'index')
                                                                    .then(results => {
                                                                        results[0].analysing.audio = false;
                                                                        return database.add(results[0], 'index');
                                                                    })
                                                                    .then(function(){
                                                                        return transcriptionData;
                                                                    })
                                                                ;

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
                                                
                                                // When we're done analysing both the frames and audio, we're free
                                                // to move on to the next bit of code!
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
                        // The analysis is complete. We're now able to query the content in the
                        // /search endpoint of our application.
                        debug('All Done.');
                        debug(data);
                    })
                    .catch(err => {
                        debug('ERR:', err);

                        return database.query({
                                selector : {
                                    "uuid" : {
                                        "$eq" : document.uuid
                                    }
                                }
                            }, 'index')
                            .then(results => {
                                results[0].analysing = {
                                    frames : false,
                                    audio : false
                                }
                                return database.add(results[0], 'index');
                            })
                            .then(function(){

                                res.status(500);
                                res.json({
                                    status : "err",
                                    message : 'An error occurred during analysis'
                                });

                            })
                        ;

                    })
                ;

            } else {

                // If the file we tried to analyse doesn't exist in the bucket,
                // we tell the user and reject the request;
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

    // Presumably, we have things we can search for in our database, so let's do it!

    if(req.body.searchTerm === "" || !req.body.searchTerm){
        res.status(422);
        res.json({
            status : "err",
            message : "No search term was passed"
        });
    } else {
    
        const phrase = req.body.searchTerm.toLowerCase();
        const tags = phrase.split(' ').map(tag => {return {'class' : tag}});
        
        tags.push({"class" : phrase});

        debug(tags);

        const queries = [];
    
        const keyframeSearch = database.query({
            "selector": {
                "analysis": {
                    "$elemMatch": {
                        "$or": tags
                    }
                }
            }
        }, 'frames');
    
        const transcriptSearch = database.query({
            "selector" : {
                "uuid" : {
                    "$exists" : true
                }
            }
        }, 'transcripts');
        
        Promise.all( [ keyframeSearch, transcriptSearch ] )
            .then(searchResults => {
                debug(searchResults);
    
                const uniqueParents = {};
    
                searchResults[0].forEach(result => {
                    debug(result);
                    if(!uniqueParents[result['parent']]){
                        uniqueParents[result['parent']] = {
                            frames : [],
                            transcript : []    
                        };
                    }
    
                    uniqueParents[result['parent']].frames.push(result);
    
                });
    
                searchResults[1].forEach(result => {
                    debug(result);
                    if(!uniqueParents[result['parent']]){
                        uniqueParents[result['parent']] = {
                            frames : [],
                            transcript : []    
                        };
                    }
    
                    result.transcript.chunks.filter(chunk => {
                        debug(chunk);
    
                        const foundInPart = tags.filter(tag => {
                            debug('tag', tag, chunk.text.indexOf(tag));
                            return chunk.text.indexOf(tag) > -1;
                        }).length > 1;
    
                        return chunk.text.indexOf(phrase) > -1 || foundInPart;
                    }).forEach(chunk => {
                        chunk.start = convertSeconds(chunk.start);
                        chunk.end = convertSeconds(chunk.end);
                        uniqueParents[result['parent']].transcript.push(chunk);
                    });
    
                });
                
                return database.query({
                        "selector": {
                            "uuid": {
                                "$or": Object.keys(uniqueParents)
                            }
                        }
                    }, 'index')
                    .then(data => {

                        debug(data);
                        
                        data.forEach(datum => {
                            uniqueParents[datum.uuid].name = datum.name;
                        });

                        res.json({
                            status : "ok",
                            message : "Data arrived.",
                            data : uniqueParents
                        });

                    })
                ;
            })
            .catch(err => {
                debug('Search err:', err);
                res.status(500);
                res.json({
                    status : "err",
                    message : "An error occurred performing the search",
                });
            })
        ;

    }

});

router.get('/check/:OBJECT_NAME', (req, res, next) => {

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

    storage.getStream(req.params.ObjectKey, 'cos-frames').pipe(res);

});

module.exports = router;
