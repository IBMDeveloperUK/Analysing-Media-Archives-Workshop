const debug = require('debug')('bin:lib:analyse');
const extractKeyFrames = require('extract-keyframes');
const VisualRecognitionV3 = require('watson-developer-cloud/visual-recognition/v3');

const visualRecognition = new VisualRecognitionV3({
    version: '2018-03-19',
    iam_apikey: process.env.VISUAL_RECOGNITION_KEY
});

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
                                debug('DAAAAATTTTAAAA:', data);
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

}

function extractEntitiesFromALargeBodyOfText(text){

}

module.exports = {
    frames : extractFramesFromVideoAndClassifyThem,
    audio : extractAudioFromVideoAndTranscribeTheContent,
    text : extractEntitiesFromALargeBodyOfText 
};