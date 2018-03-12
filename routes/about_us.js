let express = require('express');
let router = express.Router();
let mysql = require('mysql');
let config = require('../config/mysql.json');

let admin_cfg = config.admin;
let guest_cfg = config.guest;

let pool_admin = mysql.createPool(admin_cfg);
let pool_guest = mysql.createPool(guest_cfg);

router.get('/', function(req, res){
    res.render('about_us', {id: req.query.id});
});

router.get('/members', function(req, res){
    res.render('members', {id: req.query.id});
});

router.get('/our_work', function(req, res){
    res.render('our_work', {id: req.query.id});
});

router.get('/join_us', function(req, res){
    res.render('join_us', {id: req.query.id});
});

module.exports = router;