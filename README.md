# Analysing Media Archives with Artificial Intelligence
_A workshop for IBM Code London_

## Overview

By following this workshop, you will learn the following:

1. How to analyse media files with Watson Visual Recognition
2. How to transcribe media files with Watson Speech To Text
3. How to set up a Cloudant DB instance
4. How to launch a Node.js Cloud Foundry app
5. How to build a simple search engine to expose insights gained from image classification and speech transcription

You will need:

1. An IBM Cloud Account - [Register here](https://console.bluemix.net/registration/)
2. The Cloud Foundry CLI tool - [Download here](https://github.com/cloudfoundry/cli/releases)
3. Node.js (if you wish to run the app locally) - [Download here](https://nodejs.org/)

## Setup

First we'll create the services that we'll need to support our application.

We'll set up the following services in the following order (the order doesn't really matter, but it's easier to follow this way).

1. Watson Visual Recognition
2. Watson Speech To Text
3. CloudantDB
4. Node.js Cloud Foundry App
5. Cloud Object Storage

_**Before proceeding any further, please log in to your IBM Cloud account, it'll make set up go a lot faster**_.

### Watson Visual Recognition
#### Creating an instance

1. Create a Visual Recognition instance by first clicking [here](https://console.bluemix.net/catalog/services/visual-recognition).
2. In the "Service Name" input, give your instance a unique and memorable name.
3. Scroll down and check that the pricing plan you've selected is 'Lite'.
4. Click 'Create'.

### Watson Speech to Text
#### Creating an instance

1. Create a Speech to Text instance by first clicking [here](https://console.bluemix.net/catalog/services/speech-to-text)
2. In the "Service Name" input, give your instance a unique and memorable name.
3. Scroll down and check that the pricing plan you've selected is 'Lite'.
4. Click 'Create'.

### CloudantDB
#### Creating an instance

1. Create a Speech to Text instance by first clicking [here](https://console.bluemix.net/catalog/services/cloudant)
2. In the "Service Name" input, give your instance a unique and memorable name.
3. In the "Available authentication methods" dropdown, select "Use both legacy credentials and IAM"
4. Scroll down and check that the pricing plan you've selected is 'Lite'.
5. Click 'Create'.
6. You'll be taken to your Cloudant DB instance page. 

#### Creating our tables

For our application we require 3 tables - 'index', 'frames', and 'transcripts'. Follow and repeat the next set of instructions to create the needed databases.

1. On the left-hand side of your Cloudant DB dashboard, there is a button which looks like three stacked pancakes. Click it.
2. At the top right of your Cloudant DB dashboard, click 'Create Database'.
3. Enter the name of your database into the dropdown that appears (either index, frames, or transcripts) and click 'Create'
4. The database will be created, and you'll be taken to view it's documents (there aren't any yet). At the top left of your window, there will be a back arrow next to your database name. Click it.
5. You will now be back at your dashboard home page. Repeat steps 1 - 4 until you have created all 3 databases.

#### Creating an secondary index

In order for us to search for image classifications efficiently, we're going to create a secondary index.

1. Head back to the home page of your Cloudant DB instance (where you created your databases) and then click on the 'frames' database.
2. A new view will load. In the tool bar on the left hand side of the screen an option 'query' will appear, click it./
3. The sidebar will load an area where we can test Cloudant DB queries. To the bottom right of the text input there is a link 'manage indexes'. Click that.
4. The area to test Cloudant DB queries will now be replaced with an 'Index' creation field. Delete all of the text in the white box and paste the following in its place.

```json
{
    "index": {
        "fields": [
            "_id",
            "analysis.[].class"
        ]
    },
    "type": "json"
}
```
5. Click the 'Create Index' button.
6. A new index should appear in the right-hand side of the page with the title `"json: _id, analysis.[].class"`. We're done here!

### Node.js Cloud Foundry App

We want to run our app on the cloud, so we'll create a Node.js Cloud Foundry instance to host and run our application.

#### Creating an instance

1. Create a Node.js Cloud Foundry instance by clicking [here](https://console.bluemix.net/catalog/starters/sdk-for-nodejs)
2. Under app name enter something unique and memorable. The app name will be used to make up your URL, so make sure to take note of it!
3. Under 'Pricing plans' make sure that you have the 'Lite' plan selected and that you have the **256**MB option selected. The app will not run well with less memory than that.
4. Click the 'Create' button.

### Cloud Object storage

In order to analyse our media files, we need a place to put them where our app can see them. To that end, we'll create a cloud object storage instance that will let us access the files as we need them.

#### Creating an instance

1. Create an object storage instance by clicking[here](https://console.bluemix.net/catalog/services/cloud-object-storage)
2. In the "Service Name" input, give your instance a unique and memorable name.
3. Under 'Pricing plans' make sure you have the 'Lite' tier selected, then click "create".

#### Creating a bucket and uploading files

As soon as your storage instance is created, you'll be taken to its dashboard. From here, we can configure a bucket for our storage. We'll need two buckets: 1 for storing the media files that we want to analyse, and one for storing the keyframes that we extract from our videos.

First, we'll create the bucket for storing the files that we want to upload.

1. On the left-hand side of the dashboard there is a menu item titled 'Buckets'. Click it.
2. In the new view that loads, click the 'Create Bucket' button that appears on the far right of the dashboard. A dialog will open.
3. Give your bucket a name. These names are shared globally, so you won't be able to have a bucket name that anybody else on the IBM Cloud has. Make sure to take note of the name you give it, as you'll be using it in your code later on.
4. Once you've chosen a name and a region (note down your region for later) to your liking, click "Create". You'll then be taken to a view where you can upload files and folders.
5. In the new view, click 'Upload' and then 'Files' and then 'Select Files'. Select any files that you will want to analyse later. Once uploaded, they will appear in the 'Objects' table

Now that we have our bucket for storing the files we want to analyse, we're going to create a bucket that our application will write any keyframes that we extract for later viewing.

Repeat steps 1 - 4 of the previous instructions to create the new bucket, but give it a different name this time around. We're not going to directly upload any files to this bucket, our application will do that for us when we run it.

## Building our Application

We now have all of the services that we need to run our analysis application. So, it's time to build it!

### Grabbing the source code and dependencies
1. Download or `git clone` this repo using the 'Clone or download' button at the top of this page.
2. Once you've recieved the source code, open up a terminal and head into the root of the project directory with `cd <PLACE YOU DOWNLOADED THE FILE TO>/analysing-media-archives-workshop`. In this directory, we have a basic Express.js server that we can use to deliver our web user interface, and that will grab assets for analysis by Watson. 
3. If you intend to run and test this code locally, once in the directory run `npm install`, but if you only want to try the code out on the Cloud, you can skip this step.

### Getting the data for our /analyse dashboard

Our application is made up of two views _'analyse'_ and _'search'_. The _'analyse'_ view lives at the `/analyse` path of our server, the _'search'_ view is just our index page, so it lives at `/`;

In this demo application, we have all of the routes set up to deliver our application, but none of the logic for populating our application with content or search capabilites, so we'll do that now.

1. Open this folder in your favourite IDE for editing and open the file `routes/index.js`.
2. In here, you will see all of the routes we have defined for our application. We're going to edit the `GET /analyse`. Look for the code block that has `// GET ANALYSE ROUTE` in it and delete the line reading `res.end()` just after it. We'll be copy and pasting our code in this space for the next little while.
3. Copy and paste the following code on the line after `GET ANALYSE ROUTE`
```javaScript
storage.list(process.env.COS_MEDIA_ARCHIVE_BUCKET_NAME)
    .then(data => {
        // CODE BLOCK 1
        
    })
;
```
This will access our cloud object storage and get a list of all of the files in our media archive.
4. Next, we want to check whether or not we have any record of this file in our CloudantDB 'index' database. Copy and paste the following code just after the line that reads `CODE BLOCK 1`
```javascript
database.query({
        "selector": {
            "$or": data.Contents.map(fileObject => { return {"name" : fileObject.Key} })
        }
    }, 'index')
    .then(records => {
        debug('OBJS:', records);
        // CODE BLOCK 2

    })
;
```
5. Once we have those records, we also want to check whether or not these files have been previously transcribed. We can do that by running another query, but this time against our Cloudant DB 'transcript' database. Copy and paste the following code onto the line just after `// CODE BLOCK 2`.
```javascript
return database.query({
        "selector" : {
            "$or" : records.map(record => { return { "parent" : record.uuid } })
        },
    }, 'transcripts')
    .then(transcripts => { 
        // CODE BLOCK 3
        
    })    
;
```
6. We now have records of whether or not our file has ever been processed by our server before, and whether or not they've been transcribed. Now we're going to shape that information so that we can use it to render our 'analyse' view. Copy and paste the following code on the line that reads just after `// CODE BLOCK 3`
```javascript
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
```
7. We now have all of the code that we need to view our `/analyse` route! But we also need a little bit of JavaScript to make it behave the way we'd like (triggering analysis processes on demand). Find the file `/views/analyse.hbs` and open it for editing.
8. Copy and paste the following code just beneath the line that reads `// CODE BLOCK 1` (in between the `<script>` tags).
```javascript
(function(){

    'use strict';

    const analyseButtons = Array.from(document.querySelectorAll('tbody td a.analysisTrigger'));

    analyseButtons.forEach(function(button){

        button.addEventListener('click', function(e){

            e.preventDefault();
            e.stopImmediatePropagation();

            const that = this;

            if(this.dataset.requesting === "false"){

                this.textContent = 'Requesting';
                this.dataset.requesting = "true";

                fetch('/analyse/' + this.dataset.objectkey, {method : "POST"})
                    .then(function(res){
                        if(res.ok){
                            return res.json();
                        } else {
                            throw res;
                        }
                    })
                    .then(function(response){
                        console.log(response);
                        that.textContent = "Processing";

                        let check = setInterval(function(){

                            fetch('/check/' + that.dataset.objectkey)
                                .then(function(res){
                                    if(res.ok){
                                        return res.json();
                                    } else {
                                        throw res;
                                    }
                                })
                                .then(function(response){
                                    
                                    if(response.data.audio === false && response.data.frames === false){
                                        clearInterval(check);
                                        that.textContent = "Done";
                                    }

                                })
                                .catch(err => {
                                    console.log('Checking err:', err);
                                })
                            ;

                        }, 3000);

                    })
                    .catch(function(err){
                        console.log('Analyse err:', err);
                    })
                ;
                console.log(this.dataset.objectkey);
            }

        }, false);

    })

}());
```
This code will bind an event listener to the _Analyse_ buttons in the table and trigger an analysis process for that media file when clicked.

### Analysing our media object

So, now we have the code for displaying all of the objects that we can analysis, and all of the code we need to trigger an analysis. Next up, we need the code for actually performing the analysis.

1. Open up the file `/routes/index.js` for editing again.
2. Find the line that reads `// POST ANALYSE ROUTE` and delete the line that reads `res.end();` just after it.
3. On the line just after `// POST ANALYSE ROUTE` copy and paste the following code.
```javascript
const objectName = req.params.OBJECT_NAME;
debug(objectName);

storage.check(objectName, process.env.COS_MEDIA_ARCHIVE_BUCKET_NAME)
    .then(exists => {
        if(exists){
            // CODE BLOCK 4
    
        } else {
            res.status(404);
            res.json({
                status : 'err',
                message : `An object with the name '${objectName}' was not found in the object storage`
            });
        }

    })
;
```
This will check that any file that we want to analyse actually exists before we try to analyse it.
4. Copy and paste the following code just after the line that reads `// CODE BLOCK 4`
```javascript
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
                audio : true
            }
        }

        // CODE BLOCK 5

    })
    .then(function(data){
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
```
This code checks our 'index' database for a document that tells us whether or not we've analysed the file before. If a document is found, we update the document to read that we're now reanalysing the audio and keyframes of the media object. If not, we create a new object that contains the same information for future analysis.
5. Before we start any analysis, we want to clean up any existing data about the media file so that we can surface only the most recent results in any search. After the line that reads `// CODE BLOCK 5` copy and paste the following code:
```javascript
return Promise.all( [ database.query( { "selector": { "parent": { "$eq": document.uuid } } }, 'frames'), database.query( { "selector": { "parent": { "$eq": document.uuid } } }, 'transcripts') ]  )
    .then(results => {
        debug(results[0]);
        
        const keyFramesToDelete = storage.deleteMany( results[0].map(document => { return { Key: `${document.uuid}.jpg` } }), process.env.COS_KEYFRAMES_BUCKET_NAME );
        
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
        // CODE BLOCK 6
        
    })
    .catch(err => {
        debug('Dependents error (keyframes)', err);
    })
;
```
This code will find every transcript and keyframe that belongs to the selected media file and will delete both the objects from our cloud storage and the records from our database. This gives us a nice clean slate to work with.
6. Now that we've cleaned everything up, it's time to start analysing things. First, we'll add a record to our 'index' database saying that we're about to analyse the media object, and then we'll grab the object from storage for analysis. Copy and paste the following code on the line just after `// CODE BLOCK 6`
```javascript
return database.add(document, 'index')
    .then(function(){

        return storage.get(objectName, process.env.COS_MEDIA_ARCHIVE_BUCKET_NAME)
            .then(data => {
                debug(data);

                res.json({
                    status : "ok",
                    message : `Beginning analysis for '${objectName}'`
                });

                const analysis = [];

                // CODE BLOCK 7

            })
        ;
    
    })
;
```
7. In this part of the code, we're going to start two of the analysis processes - the keyframe extraction and classification, and the audio extraction and transcription. First, we'll add the code for the keyframe analysis and classification. Copy and paste the following code just after `// CODE BLOCK 7`
```javascript
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

                const saveFrame = storage.put(`${frameData.uuid}.jpg`, frame.image, process.env.COS_KEYFRAMES_BUCKET_NAME);
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

// CODE BLOCK 8

```
In this block of code, we work through every identified and classified keyframe, write the image of tha frame to storage, and then create a record in the 'frames' database with all of the information that we gained from Watson. This is the database that we'll be querying later on when looking for the content of videos.

8. Now that we have the code for extracting, analysing and storing our keyframes, it's time for the code that will extract, analyse, and store the transcripts for our media files. On the line just after `// CODE BLOCK 8`, copy and paste the following code:
```javascript
analysis.push(frameClassification);
                                                
const audioTranscription = analyse.audio(data.Body)
    .then(transcriptionData => {
        transcriptionData.uuid = uuid();
        transcriptionData.parent = document.uuid;

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

return Promise.all(analysis);
```
Just as we stored our keyframe data in the 'frames' database, with this code, we'll now have some transcripts in the 'transcripts' database.

### Searching our analysis results

Right! We can now analyse media objects. Hurrah! So let's make a simple search engine for them.

We've already got everything we need to get started, so we just need a little more code.

1. Still in the `/routes/index.js` file, find the line that starts with `// GET SEARCH ROUTE` and delete the line that read `res.end()` just after it.
2. Copy and paste the following line just after the line that reads `// GET SEARCH ROUTE`
```javascript
debug(req.body);

if(req.body.searchTerm === "" || !req.body.searchTerm){
    res.status(422);
    res.json({
        status : "err",
        message : "No search term was passed"
    });
} else {

    // CODE BLOCK 9
    
}
```
Here, we're just making sure that we're actually getting something to search for before we try to query our database. If there's no search query we just reject the request.
3. Once we get something that we can actually look for, we'll put together the database queries to surface some results (if there are any) to the user. Copy and paste the following code after the line that reads `// CODE BLOCK 9`
```javascript
const phrase = req.body.searchTerm.toLowerCase();
const tags = phrase.split(' ').map(tag => {return {'class' : tag}});
tags.push({"class" : phrase});

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

// CODE BLOCK 10

```
4. Once we have those queries ready to go, we'll fire them off to the database and wait for the results. Copy and paste the following code after the line that reads `// CODE BLOCK 10`.
```javascript
Promise.all( [ keyframeSearch, transcriptSearch ] )
    .then(searchResults => {
        debug(searchResults);

        // CODE BLOCK 11
        
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
```
5. It'll take a few seconds for the requests for both the transcripts and the keyframes results to return. Once we have both sets of results, we'll put them to work. Copy and paste the following code just after the line that reads `// CODE BLOCK 11`
```javascript
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

// CODE BLOCK 12

```
In this block of code, we're checking which frames (if any) belong to which videos and creating an object `uniqueParents` which we add all of the results that match the search terms. We then parse through the transcriptions looking for a match.
6. Once that's done, we just need to find out the file names for the media files that the classifications belong to. We'll do one final query to the 'index' database before sending the results back to the client. Copy and paste the following code beneath the line that reads `// CODE BLOCK 12`
```javascript
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
```
Et Voila! We have a simple search engine that can return results for the classifications of keyframes, and any transcribed content for a given search query.
7. Finally, we need to put together a little bit of JavaScript for a search form to work in our app. Open the file `/views/index.hbs` and copy and paste the following code on the line just after `// CODE BLOCK 13`
```javascript

(function(){

    'use strict';

    const searchForm = document.querySelector('#search');
    const resultsContainer = document.querySelector('#resultsContainer');
    const framesContainer = document.querySelector('#resultsContainer #frames');
    const transcriptContainer = document.querySelector('#resultsContainer #transcriptions');

    const overlayElement = document.querySelector('#overlay');
    const overlayContent = overlayElement.querySelector('#frameData');

    function generateTimestamps(time){
        return `${ time.hours < 10 ? '0' + time.hours : time.hours }:${time.minutes < 10 ? '0' + time.minutes : time.minutes}:${time.seconds < 10 ? '0' + time.seconds : time.seconds}`;
    }

    searchForm.addEventListener('submit', function(e){
        
        e.preventDefault();
        e.stopImmediatePropagation();

        console.log(this[0].value);

        fetch('/search', {
                method : "POST",
                headers : {
                    "Content-Type" : "application/json"
                },
                body : JSON.stringify( { searchTerm : this[0].value } )
            })
            .then(function(res){
                if(res.ok){
                    return res.json();
                } else {
                    throw res;
                }
            })
            .then(function(response){

                console.log(response.data);
                const data = response.data;
                
                const framesList = framesContainer.querySelector('ol')
                const transcriptList = transcriptContainer.querySelector('ol')
                
                framesList.innerHTML = "";
                transcriptList.innerHTML = "";

                Object.keys(data).forEach(key => {

                    const framesFragment = document.createDocumentFragment();
                    const transcriptFragment = document.createDocumentFragment();
                    
                    if(data[key].frames.length > 0){

                        const keySpan = document.createElement('span');
                        keySpan.classList.add('key');
                        keySpan.textContent = data[key].name;
                        
                        framesFragment.appendChild(keySpan);

                    }

                    data[key].frames.forEach(frame => {

                        const li = document.createElement('li');
                        const img = document.createElement('img');

                        li.dataset.timeoffset = frame.keyframeTimeoffset;
                        li.dataset.source = frame.parent;
                        img.setAttribute('src', `/keyframe/${frame.uuid}.jpg`);

                        li.addEventListener('click', function(){
                            console.log(this);
                            console.log(frame);
                            
                            overlayContent.innerHTML = "";
                            
                            const overlayFragment = document.createDocumentFragment();
                            const image = document.createElement('img');
                            const properties = document.createElement('ol');

                            image.setAttribute('src', `/keyframe/${frame.uuid}.jpg`);

                            frame.analysis.forEach(classification => {
                                const li = document.createElement('li');
                                const name = document.createElement('span');
                                const value = document.createElement('span');

                                name.textContent = classification.class;
                                value.textContent = `${classification.score * 100}%`;

                                li.appendChild(name);
                                li.appendChild(value);

                                properties.appendChild(li);

                            });

                            const closeBtn = document.createElement('button');
                            closeBtn.classList.add('closeBtn')
                            closeBtn.textContent = 'Close';

                            closeBtn.addEventListener('click', function(){
                                overlayElement.dataset.active = "false";
                            }, false);

                            overlayFragment.appendChild(image);
                            overlayFragment.appendChild(properties);
                            overlayFragment.appendChild(closeBtn);

                            overlayContent.appendChild(overlayFragment);

                            overlayElement.dataset.active = 'true';

                        }, false);

                        li.appendChild(img);
                        framesFragment.appendChild(li);

                    });

                    if(data[key].transcript.length > 0){

                        const keySpan = document.createElement('span');
                        keySpan.classList.add('key');
                        keySpan.textContent = data[key].name;
                        
                        transcriptFragment.appendChild(keySpan);

                        data[key].transcript.map(chunk => {
                            const li = document.createElement('li');
                            const timingSpan = document.createElement('span');
                            const transcription = document.createElement('p');
                            
                            li.dataset.start = JSON.stringify(chunk.start);
                            li.dataset.end = JSON.stringify(chunk.end);

                            timingSpan.classList.add('timings');
                            timingSpan.textContent = `${generateTimestamps(chunk.start)} --> ${generateTimestamps(chunk.end)}`

                            transcription.textContent = chunk.text;

                            li.appendChild(timingSpan);
                            li.appendChild(transcription);

                            li.addEventListener('click', function(){
                                console.log(this);
                            }, false);

                            transcriptFragment.appendChild(li);

                        });        

                    }

                    framesList.appendChild(framesFragment);
                    transcriptList.appendChild(transcriptFragment);

                }); 

                resultsContainer.dataset.active = "true";

            })
            .catch(function(err){
                console.log('Search err:', err);
            })

    }, false);

}());
```
Save the file, and now we have a search field that we can use to make queries to our server.

## Running the application

In order to run the application, we first need to set up some environment variables. 

### Setting up variables locally

1. In the root of your project folder (the folder with the app.js file in it) create a new file called `.env`.
2. Copy and paste the following block of text into your newly created `.env` file and save it.

```
DEBUG=*

COS_ENDPOINT=
COS_REGION=
COS_ACCESS_KEY_ID=
COS_ACCESS_KEY_SECRET=
COS_MEDIA_ARCHIVE_BUCKET_NAME=
COS_KEYFRAMES_BUCKET_NAME=

DATABASE_USERNAME=
DATABASE_PASSWORD=
DATABASE_ENDPOINT=

VISUAL_RECOGNITION_KEY=

STT_USERNAME=
STT_PASSWORD=
STT_URL=
```

### Getting the values for your environment variables

#### Cloud Object Storage

Variables required:
1. COS_ENDPOINT
2. COS_REGION
3. COS_ACCESS_KEY_ID
4. COS_ACCESS_KEY_SECRET
5. COS_MEDIA_ARCHIVE_BUCKET_NAME
6. COS_KEYFRAMES_BUCKET_NAME

To get the environment variables to access your cloud object storage, follow these next steps:

1. Go to your [IBM Cloud Dashboard](https://console.bluemix.net/dashboard/apps) and find the storage instance you created at the start of this document. Click to view the instance.
2. On the left hand side of the screen there is an option 'Service Credentials', click it, and then click 'New Credential' after it appears on the right side of the screen.
3. Give your credentials a name, and then in the "Add Inline Configuration Parameters (Optional)" text field enter `{"HMAC" : true}`.
4. Click 'Add'
5. Your new credentials will appear in the table entitled 'Service Credentials'. Click the 'View credentials' dropdown to view your newly created credentials.
6. - For the `COS_ENDPOINT` environment variable, enter the endpoint that matches the region you selected. You can find a list of endpoints [here](https://console.bluemix.net/docs/services/cloud-object-storage/basics/endpoints.html#select-regions-and-endpoints)
- For the `COS_REGION` environment variable, enter the region you selected when you created your buckets.
- For the `COS_ACCESS_KEY_ID` environment variable, copy and paste the `access_key_id` value from the service credentials 
- For the `COS_ACCESS_KEY_SECRET` environment variable, copy and paste the `secret_access_key` value from the service credentials 
- For the `COS_MEDIA_ARCHIVE_BUCKET_NAME` environment variable, enter the name you gave for the bucket you created to store your media files in
- For the `COS_KEYFRAMES_BUCKET_NAME` environment variable, enter the name you gave the second bucket you created for storing the keyframes

#### Cloudant DB 

Variables required:
1. DATABASE_USERNAME
2. DATABASE_PASSWORD
3. DATABASE_ENDPOINT

To get the environment variables needed to access your database, follow these next steps:

1. Go to your [IBM Cloud Dashboard](https://console.bluemix.net/dashboard/apps) and find the Cloudant DB instance you created at the start of this document. Click to view the instance.
2. On the left hand side of the screen there is an option 'Service Credentials', click it, and then click 'New Credential' after it appears on the right side of the screen.
3. Give your credentials a name, and then click 'Add'
4. Your new credentials will appear in the table entitled 'Service Credentials'. Click the 'View credentials' dropdown to view your newly created credentials.
5. 
    - For the `DATABASE_USERNAME` environment variable, copy and paste the `username` value from the service credentials
    - For the `DATABASE_PASSWORD` environment variable, copy and paste the `password` value from the service credentials
    - For the `DATABASE_ENDPOINT` environment variable, copy and paste the `url` value from the service credentials

#### Watson Visual Recognition

Variables required:
1. VISUAL_RECOGNITION_KEY

To get the environment variables needed to use Watson Visual Recognition, follow these next steps:

1. Go to your [IBM Cloud Dashboard](https://console.bluemix.net/dashboard/apps) and find the Watson Visual Recognition instance you created at the start of this document. Click to view the instance.
2. On the left hand side of the screen there is an option 'Service Credentials', click it.
3. On the page, there will be an item in the table titled 'Auto-generated service credentials'. Click the 'View credential' dropdown next to it,
4. - For the `VISUAL_RECOGNITION_KEY` environment variable, copy and paste the `apikey` value from the service credentials.

#### Watson Speech to Text

Variables required:
1. STT_USERNAME
2. STT_PASSWORD
3. STT_URL

To get the environment variables needed to use Watson Speech to Text, follow these next steps:

1. Go to your [IBM Cloud Dashboard](https://console.bluemix.net/dashboard/apps) and find the Watson Visual Recognition instance you created at the start of this document. Click to view the instance.
2. On the left hand side of the screen there is an option 'Service Credentials', click it.
3. On the page, there will be an item in the table titled 'Auto-generated service credentials'. Click the 'View credential' dropdown next to it,
4. - For the `STT_USERNAME` environment variable, copy and paste the `username` value from the service credentials.
- For the `STT_PASSWORD` environment variable, copy and paste the `password` value from the service credentials.
- For the `STT_URL` environment variable, copy and paste the `url` value from the service credentials.