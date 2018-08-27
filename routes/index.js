const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/analyse', function(req, res, next) {
  res.render('analyse', { title: 'Express' });
});


module.exports = router;
