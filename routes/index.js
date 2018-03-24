var express = require('express');
let mysql = require('mysql');
var router = express.Router();
let config = require('../config/mysql.json');
let check = require('../public/javascripts/check');

let admin_cfg = config.admin;
let guest_cfg = config.guest;

pool_admin = mysql.createPool(admin_cfg);
pool_guest = mysql.createPool(guest_cfg);

let count4login = 0;

/* GET home page. */
router.get('/', function(req, res, next) {
  console.log(count4login);
  let id = req.query.id;
  let ip_info = req.headers.remoteip || req.socket.remoteAddress;
  let reg = /^[\d]+$/;
  if(!reg.test(id))
  {
    res.render('index', {id: -1, count: count4login});
  }
  else
  {
    let now = new Date();
    let timestamp = now.getTime();
    check.check_already_login(id, ip_info, timestamp, false, function(already, valid){
      if(!already || !valid)
      {
        res.render('index', {id: -1, count: count4login});
      }
      else
      {
        res.render('index', {id: id, count: count4login});
      }
    });
  }
});

/** 普通登录界面 */
router.get('/login', function(req, res){
  res.render('login', {admin: false});
});

/** 注册界面 */
router.get('/register', function(req, res){
  res.render('register', {message: "请填写以下信息"});
});

/**  登录 */
router.post('/login', function(req, res){
  let university = req.body.university;
  let number = req.body.number;
  let password = req.body.password;
  pool_guest.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      let sql = `select id,name,password from users where university=${university} and number=${number};`;
      conn.query(sql, function(err, rows){
        if(typeof(rows) === "undefined" || rows.length < 1)
        {
          res.render('error', {error: {}, message: "用户不存在", action: "/login"});
        }
        else if(rows.length > 1)
        {
          res.render('error', {error: {}, message: "该账号对应多个用户,请联系管理员处理", action: "/login"});
        }
        else if(password !== rows[0].password)
        {
          res.render('error', {error:{}, message: "密码错误", action: "/login"});
        }
        else
        {
          let now = new Date();
          let timestamp = now.getTime();
          let ip_info = req.headers.remoteip || req.socket.remoteAddress;
          check.check_already_login(rows[0].id, ip_info, timestamp, false, function(already, valid){
            if(already === false)
            {
              check.add_login(rows[0].id, ip_info, timestamp, false, function(done){
                if(!done)
                {
                  res.render('error', {error:{}, message: "用户登录失败", action: "/"});
                }
                else
                {
                  count4login += 1;
                  res.redirect(`/?id=${rows[0].id}`);
                }
              });
            }
            else
            {
              check.refresh_login(rows[0].id, ip_info, timestamp, false, function(done){
                if(!done)
                {
                  count4login += 1;
                  res.render('error', {error: {}, message: "用户登录失败", action: "/"});
                }
                else
                {
                  res.redirect(`/?id=${rows[0].id}`);
                }
              });
            }
          });
        }
      });
      conn.release();
    }
  });
});

/** 注册 */
router.post('/register', function(req, res){
  name = req.body.name;
  number = req.body.number;
  school = req.body.school;
  university = req.body.university;
  password = req.body.password;
  email = req.body.email;
  phone_number = req.body.phone_number;
  gender = req.body.gender;

  let reg = /^[\d]+$/;
  if(!reg.test(number))
  {
        res.render('error', {error:{}, message: "学号应全为数字", action: "/register"});
  }
  else{
  pool_admin.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      let sql = `select id from users where university = ${university} and number = ${number}`;
      conn.query(sql, function(err, rows){
        if(err){console.log(err);}
        else
        {
          if(rows === undefined || rows.length < 1)
          {
            let sql = `insert into users(name,number,school,university,password,email,phone_number,gender)
            values('${name}',${number},'${school}',${university},'${password}','${email}',${phone_number},${gender});`;
            conn.query(sql, function(err){
              if(err){console.log(err);}
              else
              {
                let sql = `select id from users where university=${university} and number=${number};`;
                conn.query(sql, function(err, rows1){
                  if(err || rows1 === undefined || rows1.length < 1)
                  {
                    console.log(err);
                    res.render('error', {error: {}, message: `注册失败`, action: "/"});
                  }
                  else
                  {
                    res.render('error', {error: {}, message: `注册成功，您的id是${rows1[0].id}，请牢记`, action: "/"});
                  }
                });
              }
            });
          }
          else
          {
            res.render('register', {message: "该同学已经注册"});
          }
        }
      });
      conn.release();
    }
  });}
});

router.get('/logout', function(req, res){
  let id = req.query.id;
  check.logout(id, function(done){
    res.render('index', {id: -1, count: count4login});
  });
});

module.exports = router;
