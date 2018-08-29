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
    res.end();
});

router.post('/analyse/:OBJECT_NAME', (req, res, next) => {
    res.end();
});

router.post('/search', (req, res, next) => {
    res.end();
});

router.get('/check/:OBJECT_NAME', (req, res, next) => {
    res.end()
});

router.get('/keyframe/:ObjectKey', (req, res, next) => {
    res.end();
});

module.exports = router;
