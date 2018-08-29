const debug = require('debug')('routes:storage');
const express = require('express');
const router = express.Router();

const storage = require(`${__dirname}/../bin/lib/storage`);

/* GET home page. */
router.get('/', (req, res, next) => {
    res.end();
});

router.get('/list', (req, res, next) => {

    storage.list(`${process.env.COS_DEFAULT_BUCKET}`)
        .then(data => {
            debug(data);
            res.json(data);       
        })
    ;

});

module.exports = router;
