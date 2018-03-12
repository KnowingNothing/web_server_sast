let express = require('express');
let router = express.Router();
let mysql = require('mysql');
let config = require('../config/mysql.json');
let check = require('../public/javascripts/check');

let admin_cfg = config.admin;
let guest_cfg = config.guest;
let store_path = config.store_path;

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

router.get('/contests', function (req, res) {
  let id = req.query.id;
  let file_name = req.query.file_name;
  let ip_info = req.headers.remoteip || req.socket.remoteAddress;
  let reg1 = /^[\d]+$/;
  let reg2 = /[^\\]*\.(\w+)$/;
  if(!reg2.test(file_name) || !reg1.test(id))
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
            if (file_name === undefined) res.redirect('/login');
            console.log('file downloaded: ' + store_path + filename);
            res.download(store_path + filename);
          }
  });
  }
});

module.exports = router;