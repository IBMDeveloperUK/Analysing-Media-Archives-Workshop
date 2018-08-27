const debug = require('debug')('routes:database');
const express = require('express');
const router = express.Router();

const database = require(`${__dirname}/../bin/lib/storage`);

/* GET home page. */
router.get('/', (req, res, next) => {
    res.end();
});

router.get('/search', (req, res, next) => {
    res.end();
});

module.exports = router;
