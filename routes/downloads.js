let express = require('express');
let router = express.Router();
let mysql = require('mysql');
let config = require('../database/configure.json');
let check = require('../public/javascripts/check');

let admin_cfg = config.admin;
let guest_cfg = config.guest;

let pool_admin = mysql.createPool(admin_cfg);
let pool_guest = mysql.createPool(guest_cfg);

router.get('/', function(req, res){
    let id = req.query.id;
    let ip_info = req.headers.remoteip || req.socket.remoteAddress;
    let reg = /^[\d]+$/;
    if(!reg.test(id))
    {
        res.redirect('/login');
    }
    else
    {
        now = new Date();
        timestamp = now.getTime();
        check.check_already_login(id, ip_info, timestamp, false, function(already, valid){
            if(!already || !valid)
            {
                res.redirect('/login');
            }
            else
            {
                res.render('downloads', {id: id});
            }
    });
    }
});

module.exports = router;