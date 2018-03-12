let express = require('express');
let router = express.Router();
let mysql = require('mysql');
let config = require('../config/mysql.json');
let check = require('../public/javascripts/check');

let admin_cfg = config.admin;
let guest_cfg = config.guest;

let pool_admin = mysql.createPool(admin_cfg);
let pool_guest = mysql.createPool(guest_cfg);

router.get('/', function(req, res){
    let id = req.query.id;
    let reg = /^[\d]+$/;
    let ip_info = req.headers.remoteip || req.socket.remoteAddress;
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
                res.render('volunteers', {id: id});
            }
    });
    }
});

router.get('/volunteer', function(req, res){
    let id = req.query.id;
    let activity = req.query.activity;
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
                check.already_sign_activity(id, activity, function(flag, info){
                    if(flag)
                    {
                        res.render('volunteer_state', {
                            id: id,
                            activity: activity,
                            sign: true,
                            attend_confirm: info.attend_confirm,
                            group: info.group
                        });
                    }
                    else
                    {
                        res.render('volunteer_state', {
                            id: id,
                            activity: activity,
                            sign: false,
                            attend_confirm: -1,
                            group: 0
                        });
                    }
                });
            }
    });
    }
});

router.get('/volunteer/sign', function(req, res){
    let id = req.query.id;
    let activity = req.query.activity;
    check.sign_activity(id, activity, function(done){
        if(!done)
        {
            res.render('error', {error:{}, message: "报名志愿活动，请重试", action: `/volunteers/volunteer/?id=${id}&activity=${activity}`});
        }
        else
        {
            res.render('error', {error:{}, message: "报名志愿活动成功", action: `/volunteers/volunteer/?id=${id}&activity=${activity}`});
        }
    });
});

router.get('/volunteer/sign_group', function(req, res){
    let id = req.query.id;
    let activity = req.query.activity;
    let group = req.query.group;
    check.change_group(id, activity, group, 1, function(done){
        if(!done)
        {
            res.render('error', {error:{}, message: "报名小组失败，请重试", action: `/volunteers/volunteer/?id=${id}&activity=${activity}`});
        }
        else
        {
            res.render('error', {error:{}, message: "报名小组成功", action: `/volunteers/volunteer/?id=${id}&activity=${activity}`});
        }
    });
});

router.get('/volunteer/resign_group', function(req, res){
    let id = req.query.id;
    let activity = req.query.activity;
    let group = req.query.group;
    check.change_group(id, activity, group, 0, function(done){
        if(!done)
        {
            res.render('error', {error:{}, message: "退出小组失败，请重试", action: `/volunteers/volunteer/?id=${id}&activity=${activity}`});
        }
        else
        {
            res.render('error', {error:{}, message: "退出小组成功", action: `/volunteers/volunteer/?id=${id}&activity=${activity}`});
        }
    });
});

module.exports = router;