const debug = require('debug')('bin:lib:storage');
const AWS = require('aws-sdk');

AWS.config.update({
    endpoint : process.env.COS_ENDPOINT,
    accessKeyId: process.env.COS_ACCESS_KEY_ID,
    secretAccessKey: process.env.COS_ACCESS_KEY_SECRET,
    region: process.env.COS_REGION || 'eu-geo'
});

const S3 = new AWS.S3();

function checkObjectIsInS3(filename, bucket = process.env.COS_DEFAULT_BUCKET){

	return new Promise( (resolve, reject) => {

		S3.headObject({
			Bucket : bucket,
			Key : filename
		}, (err, data) => {

			if(err && err.code === 'NotFound'){
				resolve(false);
			} else if(err){
				reject(err);
			} else {
				resolve(data);
			}

		});

	} );

}

function getObjectFromS3(filename, bucket = process.env.COS_DEFAULT_BUCKET){
	
	return new Promise( (resolve, reject) => {

		S3.getObject({
			Bucket : bucket,
			Key : filename		
		}, (err, data) => {

			if(err){
				reject(err);
			} else {
				resolve(data);
			}

		});

	} );

}

function putObjectInS3Bucket(filename, data, tags, bucket = process.env.COS_DEFAULT_BUCKET){
	
	return new Promise( (resolve, reject) => {

		S3.putObject({
			Bucket : bucket,
			Key : filename,
            Body : data,
            Tagging : Object.keys(tags).map(key => { return `${key}=${tags[key]}` }).join('&')
		}, err => {

			if(err){
				reject(err);
			} else{
				resolve();
			}

		});

	} );

}

function listObjectsInS3Bucket(bucket = process.env.COS_DEFAULT_BUCKET){
    return new Promise( (resolve, reject) => {
        
        S3.listObjects({
            Bucket : bucket
        }, (err, data) => { 

            if(err){
                reject(err);
            } else {
                resolve(data);
            }

        });

    });
}

module.exports = {
	check : checkObjectIsInS3,
	get : getObjectFromS3,
    put : putObjectInS3Bucket,
    list : listObjectsInS3Bucket
}