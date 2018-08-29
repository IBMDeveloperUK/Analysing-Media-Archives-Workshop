const debug = require('debug')('bin:lib:analyse');
const fs = require('fs');
const uuid = require('uuid/v4');
const spawn = require(`child_process`).spawn;
const extractKeyFrames = require('extract-keyframes');
const ffmpeg = require('ffmpeg-static');
const rimraf = require('rimraf');

// Helpful variables
const WORKING_DIRECTORY = process.env.WORKING_DIRECTORY || '/tmp';
const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpeg.path;

// Watson dependencies
var SpeechToTextV1 = require('watson-developer-cloud/speech-to-text/v1');
const VisualRecognitionV3 = require('watson-developer-cloud/visual-recognition/v3');

const visualRecognition = new VisualRecognitionV3({
    version: '2018-03-19',
    iam_apikey: process.env.VISUAL_RECOGNITION_KEY
});

const speechToText = new SpeechToTextV1({
    username: process.env.STT_USERNAME,
    password: process.env.STT_PASSWORD,
    url: process.env.STT_URL
});

function spawnProcess(binaryPath, args){
	debug(`\n\n`, binaryPath, args.join(` `), `\n\n`);
	return spawn(binaryPath, args);
}

function extractFramesFromVideoAndClassifyThem(file){

    function classifyImage(image){

        debug('Classifying an image', image);

        return new Promise( (resolve, reject) => {

            var params = {
                images_file: image,
                classifier_ids: ['default']
            };

            visualRecognition.classify(params, function(err, response) {
                if(err){
                    debug('Watson Visual Recognition Err:', err);
                    reject(err);
                } else {
                    debug('Watson response:', response);
                    resolve(response.images[0].classifiers[0].classes);
                }
            });

        });

    }

    return new Promise( (resolve, reject) => {

        extractKeyFrames( file )
            .then(eP => {
                
                const frames = [];

                eP.on('keyframe', function(data){
                    
                    debug('keyframe data:', data);

                    const analyseImage = new Promise( (resolve, reject) => {
                        classifyImage(data.image)
                            .then(analysis => {
                                data.analysis = analysis;
                                debug('Watson Data:', data);
                                resolve(data);
                            })
                            .catch(err => {
                                debug('Analysis err:', err);
                                resolve(data);
                            })
                        ;
                    });
                    frames.push(analyseImage);

                });
    
                eP.on('finish', function(data){
                    debug('finish');
                    debug('FRAYMES:', frames); 

                    Promise.all(frames)
                        .then(results => {
                            debug(results);
                            resolve(results);
                        })
                        .catch(err => {
                            debug('Promise.all err:', err);
                        })
                    ;

                })
            })
        ;

    });

}

function extractAudioFromVideoAndTranscribeTheContent(file){

    function transcribeAudio(audio){

        debug('audio file:', audio);

        const recognizeParams = {
            audio: audio,
            'content_type': 'audio/mp3',
            timestamps: true,
            model : 'en-US_BroadbandModel',
            word_confidence : false
        };

        return new Promise( (resolve, reject) => {

            speechToText.recognize(recognizeParams, function(err, STTResults) {
                if (err) {
                    debug('STT err:', err);
                    reject(err);
                } else {
                    debug('STT STTResults:', STTResults);

                    const combinedTranscription = {
                        transcript : {
                            full : "",
                            chunks : []
                        },
                        timestamps : [],
                    }

                    STTResults.results.forEach(result => {
                        combinedTranscription.transcript.full += `${result.alternatives[0].transcript}`
                        combinedTranscription.transcript.chunks.push({
                            text : result.alternatives[0].transcript,
                            start : result.alternatives[0].timestamps[0][1],
                            end : result.alternatives[0].timestamps[result.alternatives[0].timestamps.length - 1][2]
                        })
                    });

                    resolve(combinedTranscription);
                }
            });

        });


    }

    const TMP_ID = uuid();
    const INPUT_DESTINATION = `${WORKING_DIRECTORY}/${TMP_ID}`;
    const OUTPUT_DESTINATION = `${WORKING_DIRECTORY}/${TMP_ID}.mp3`;

    return new Promise( (resolve, reject) => {

        fs.writeFile(INPUT_DESTINATION, file, (err) => {
            if(err){
                debug('Filesystem write err:', err);
                reject(err);
            } else {

                const extractAudioProcessArguments = [
                    '-i',
                    `${INPUT_DESTINATION}`,
                    '-y',
                    '-ar',
                    '48000',
                    '-af',
                    `highpass=f=200, lowpass=f=5000`,
                    '-ab',
                    '64',
                    '-ac',
                    '1',
                    '-acodec',
                    'mp3',
                    `${OUTPUT_DESTINATION}`
                ];
            
                const audioExtractionProcess = spawnProcess( FFMPEG_PATH, extractAudioProcessArguments );

                audioExtractionProcess.on(`close`, (code) => {
            
                    debug(`FFMPEG closed with status ${code}`);
                    if(code === 0){
                           
                        debug(OUTPUT_DESTINATION);
                        transcribeAudio( fs.createReadStream(OUTPUT_DESTINATION) )
                            .then(transcriptionData => {

                                resolve(transcriptionData);

                                rimraf(OUTPUT_DESTINATION, {},(err) => {
                                    if(err){
                                        debug(`There was an error unlinking '${OUTPUT_DESTINATION}'`, err);
                                    } else {
                                        debug(`Directory '${OUTPUT_DESTINATION}' successfully unlinked`);
                                    }
                                });

                                rimraf(INPUT_DESTINATION, {},(err) => {
                                    if(err){
                                        debug(`There was an error unlinking '${INPUT_DESTINATION}'`, err);
                                    } else {
                                        debug(`Directory '${INPUT_DESTINATION}' successfully unlinked`);
                                    }
                                });

                            })
                            .catch(err => {
                                reject(err);
                            })
                        ;

                    } 
            
                });

            }
        });


    });

}

function extractEntitiesFromALargeBodyOfText(text){

}

module.exports = {
    frames : extractFramesFromVideoAndClassifyThem,
    audio : extractAudioFromVideoAndTranscribeTheContent,
    text : extractEntitiesFromALargeBodyOfText 
};