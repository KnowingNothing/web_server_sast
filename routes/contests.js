let express = require('express');
let router = express.Router();
let mysql = require('mysql');
let config = require('../config/mysql.json');
let check = require('../public/javascripts/check');
let fs = require('fs');
let multer = require('multer');
let store_path = config.store_path;///contests/jiying/';
let storage = multer.diskStorage({
       destination: function (req, file, cb) {
           cb(null, store_path);
      },
     filename: function (req, file, cb) {
		 console.log(file.originalname);
         cb(null, "" + file.originalname);
     }
    });
let upload = multer({
        storage: storage
});

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
                res.render('contests', {id: id});
            }
    });
    }
});

router.get('/contest', function(req, res){
    let id = req.query.id;
    let contest = req.query.contest;
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
                check.already_sign_contest(id, contest, function(flag, info){
                    if(flag)
                    {
                        let res_info = {
                            id: id,
                            contest: contest,
                            sign: true,
                            attend_confirm: info.attend_confirm,
                            prize: info.prize,
                            team_name: info.team_name,
                            team_id: info.team_id,
                            member_info: info.member_info,
                            other: info.other,
                            file_name: info.file_name
                        };
                        res.render('contest_state', res_info);
                    }
                    else
                    {
                        res.render('contest_state', {
                            id: id,
                            contest: contest,
                            sign: false,
                            attend_confirm: -1,
                            prize: -1,
                            team_name: -1,
                            team_id: -1,
                            member_info: '',
                            other: -1,
                            file_name: 'Undefined'
                        });
                    }
                });

            }
    });
    }
});

router.get('/sign', function(req, res){
    let id = req.query.id;
    let contest = req.query.contest;
    let type = req.query.type;
    check.sign_contest(id, contest, type, function(done){
        if(!done)
        {
            res.render('error', {error: {}, message: "报名失败", action: `/contests/contest/?id=${id}&contest=${contest}&type=${type}`});
        }
        else
        {
            res.render('error', {error: {}, message: "报名成功", action: `/contests/contest/?id=${id}&contest=${contest}&type=${type}`});
        }
    });
});

router.get('/add_member', function(req, res){
    let id = req.query.id;
    let contest = req.query.contest;
    let number = req.query.number;
    let reg = /^[\d]+$/;
    if(!reg.test(number))
    {
        res.render('error', {error: {}, message: "无法加入，id有误，请重试", action: `/contests/contest/?id=${id}&contest=${contest}`});
    }
    if(id === number)
    {
        res.render('error', {error: {}, message: "您不必加入自己", action: `/contests/contest/?id=${id}&contest=${contest}`});
    }
    check.already_sign_contest(number, contest, function(already){
        if(!already)
        {
            res.render('error', {error: {}, message: "无法加入，该同学尚未注册，请重试", action: `/contests/contest/?id=${id}&contest=${contest}`});
        }
        else
        {
            check.add_member(id, contest, number, function(done){
                if(!done)
                {
                    res.render('error', {error: {}, message: "无法加入，您的队伍可能人员已满，请重试", action: `/contests/contest/?id=${id}&contest=${contest}`});
                }
                else
                {
                    res.render('error', {error: {}, message: "加入成功", action: `/contests/contest/?id=${id}&contest=${contest}`});
                }
            });
        }
    });
});

router.get('/change_team_name', function(req, res){
    let id = req.query.id;
    let contest = req.query.contest;
    let new_team = req.query.new_team;
    check.change_team_name(id, contest, new_team, function(done){
        if(!done)
        {
            res.render('error', {error: {}, message: "无法加入，这个队伍可能已经存在了，请重试", action: `/contests/contest/?id=${id}&contest=${contest}`});
        }
        else
        {
            res.render('error', {error: {}, message: "更改队伍名成功，新的队伍名为："+new_team, action: `/contests/contest/?id=${id}&contest=${contest}`});
        }
    });
});

router.post('/upload', upload.single('file'), function(req, res){
    let id = req.query.id;
    let contest = req.query.contest;
	console.log('start to upload file');
    if(req.file)
    {
        let name = req.file.originalname;
		console.log('check : ' + name);
        check.handin_works(id, contest, name, function(done){
            if(!done)
            {
                res.render('error', {error: {}, message: "上传失败，请重试", action: `/contests/contest/?id=${id}&contest=${contest}`});
            }
            else
            {
                //let now = new Date();
                //let fix = now.getFullYear()+'-'+(now.getMonth() + '1')+'-'+now.getDate()+'-'+now.getHours()+"-"+now.getMinutes()+"-"+now.getSeconds()+"-"+now.getMilliseconds();
                // let newname = store_path+group_id+'-'+name;
                //let newname = store_path+group_id+'.'+name.split('.').slice(1).join('.');
                //fs.renameSync(store_path+name, newname);
                res.render('error', {error: {}, message: "上传成功", action: `/contests/contest/?id=${id}&contest=${contest}`});
            }
        });
    }
    else
    {
        res.render('error', {error: {}, message: "上传失败，请重试", action: `/contests/contest/?id=${id}&contest=${contest}`});
    }
});

module.exports = router;